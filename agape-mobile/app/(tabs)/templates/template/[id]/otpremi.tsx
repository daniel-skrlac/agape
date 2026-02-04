import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import TemplatesHeader from "../../TemplatesHeader";
import Colors from "@/constants/Colors";

import { Banner } from "@/components/Banner";
import { Sheet } from "@/components/Sheet";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { toLocalDateString } from "@/components/date";

import type {
  DraftMode,
  PartnerResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  ItemDescriptorResponseDTO,
  TemplateDocResponseDTO,
} from "@/app/models/generated";

import { partnerService } from "@/app/api/services/partnerService";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";

import { useBookMany, useBookOne, useTemplate } from "@/app/api/hooks/useDispatchTemplates";
import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";

function normId(x: any) {
  return Number(x);
}

type QtyMap = Record<string, number>;

function upsertQty(qty: QtyMap, itemId: number, delta: number) {
  const k = String(itemId);
  const cur = Number(qty[k] ?? 0);
  const next = cur + delta;
  if (next <= 0) {
    const { [k]: _, ...rest } = qty;
    return rest;
  }
  return { ...qty, [k]: next };
}

function qtyToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0);
}

function mapToDocPatches(docId: number, addItems: TemplateBookItemDTO[]): TemplateBookDocPatchDTO {
  return {
    documentId: docId,
    addItems,
    setItems: [],
    removeItemIds: [],
    draftOverride: null as any,
    noteOverride: null as any,
  } as any;
}

/**
 * Otpremi = Template booking (one template, one/many partners).
 * - Uses defaultWarehouseId from session ONLY.
 * - Supports adding extra items:
 *    - per document (docPatches.addItems)
 *    - standalone extra items (user chooses which doc they go into)
 */
export default function Otpremi() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const tplQ = useTemplate(templateId);
  const template = tplQ.data;

  const bookOneM = useBookOne();
  const bookManyM = useBookMany();

  const err =
    (tplQ.error as any)?.message ||
    (bookOneM.error as any)?.message ||
    (bookManyM.error as any)?.message ||
    null;

  // block if missing warehouse
  if (ready && !warehouseId) {
    return (
      <Screen>
        <TemplatesHeader title="Otpremi" subtitle={`Template #${templateId}`} fallbackHref="/(tabs)/templates" />
        <View style={s.container}>
          <Banner type="error" text="Missing default warehouse. Go to Settings and select main warehouse first." />
        </View>
      </Screen>
    );
  }

  // partners
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<PartnerResponseDTO[]>([]);
  const selectedPartnerIds = useMemo(() => new Set(selectedPartners.map((p) => normId(p.id))), [selectedPartners]);

  const togglePartner = (p: PartnerResponseDTO) => {
    const pid = normId(p.id);
    const exists = selectedPartners.some((x) => normId(x.id) === pid);
    setSelectedPartners(exists ? selectedPartners.filter((x) => normId(x.id) !== pid) : [...selectedPartners, p]);
  };

  // draft/final only (no RESPECT_TEMPLATE)
  const [draftMode, setDraftMode] = useState<DraftMode>("DRAFT");

  // session-only overrides for this booking run
  const [docPatches, setDocPatches] = useState<TemplateBookDocPatchDTO[]>([]);

  // standalone items (not tied by user) - we’ll assign them to a chosen doc id
  const [standaloneDocId, setStandaloneDocId] = useState<number | null>(null);
  const [standaloneQty, setStandaloneQty] = useState<QtyMap>({});

  // result
  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState("");

  const templateDocs: TemplateDocResponseDTO[] = (template?.documents ?? []) as any;

  const patchByDocId = useMemo(() => {
    const m = new Map<number, TemplateBookDocPatchDTO>();
    (docPatches ?? []).forEach((p) => m.set(Number(p.documentId), p));
    return m;
  }, [docPatches]);

  // --------------------------
  // Item picker (reuse pattern from Dokumenti screen: +1 / long press -1)
  // --------------------------
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerTarget, setItemPickerTarget] = useState<
    | { kind: "DOC"; documentId: number }
    | { kind: "STANDALONE" }
    | null
  >(null);

  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});

  const openDocAddItems = (documentId: number) => {
    const patch = patchByDocId.get(Number(documentId));
    const m: QtyMap = {};
    (patch?.addItems ?? []).forEach((it) => (m[String(it.itemId)] = Number(it.quantity ?? 0)));
    setQtyDraft(m);
    setItemPickerTarget({ kind: "DOC", documentId });
    setItemPickerOpen(true);
  };

  const openStandaloneItems = () => {
    setQtyDraft({ ...standaloneQty });
    setItemPickerTarget({ kind: "STANDALONE" });
    setItemPickerOpen(true);
  };

  const applyPickedItems = () => {
    if (!itemPickerTarget) return;

    const items = qtyToItems(qtyDraft);

    if (itemPickerTarget.kind === "DOC") {
      const docId = Number(itemPickerTarget.documentId);
      const next = [...docPatches];
      const idx = next.findIndex((p) => Number(p.documentId) === docId);

      if (items.length === 0) {
        // remove patch if empty
        if (idx >= 0) next.splice(idx, 1);
      } else {
        const patch = mapToDocPatches(docId, items);
        if (idx === -1) next.push(patch);
        else next[idx] = { ...next[idx], addItems: items as any };
      }

      setDocPatches(next);
    } else {
      setStandaloneQty(qtyDraft);
    }

    setItemPickerOpen(false);
  };

  // --------------------------
  // Submit
  // --------------------------
  const buildDocPatchesWithStandalone = () => {
    // standalone items must be assigned to some docId
    const standaloneItems = qtyToItems(standaloneQty);
    if (standaloneItems.length === 0) return docPatches;

    // if user didn’t pick doc, default to first template doc
    const targetDocId = standaloneDocId ?? Number(templateDocs?.[0]?.documentId ?? 0);
    if (!targetDocId) return docPatches;

    const next = [...docPatches];
    const idx = next.findIndex((p) => Number(p.documentId) === targetDocId);

    if (idx === -1) {
      next.push(mapToDocPatches(targetDocId, standaloneItems));
    } else {
      // merge into existing addItems
      const cur = next[idx]?.addItems ?? [];
      const byId = new Map<number, number>();

      [...cur, ...standaloneItems].forEach((x: any) => {
        const id = Number(x.itemId);
        const q = Number(x.quantity ?? 0);
        if (!id || q <= 0) return;
        byId.set(id, (byId.get(id) ?? 0) + q);
      });

      next[idx] = {
        ...next[idx],
        addItems: Array.from(byId.entries()).map(([itemId, quantity]) => ({ itemId, quantity })) as any,
      };
    }

    return next;
  };

  const submit = async () => {
    if (!warehouseId) return;
    if (selectedPartners.length === 0) return;

    if (!templateDocs || templateDocs.length === 0) {
      setResultText("Template has no documents.");
      setResultOpen(true);
      return;
    }

    const documentDate = toLocalDateString(new Date());

    const finalDocPatches = buildDocPatchesWithStandalone();

    if (selectedPartners.length === 1) {
      const res = await bookOneM.mutateAsync({
        templateId,
        warehouseId,
        partnerId: selectedPartners[0].id,
        documentDate: documentDate as any,
        draftMode: draftMode as any,
        docPatches: finalDocPatches as any,
        extraDocuments: [] as any, // kept for backward compat, backend can ignore
      } as any);

      setResultText(`Succeeded: ${res.succeeded}/${res.total} • Failed: ${res.failed}`);
      setResultOpen(true);
      return;
    }

    const res = await bookManyM.mutateAsync({
      templateId,
      warehouseId,
      partnerIds: selectedPartners.map((x) => x.id),
      documentDate: documentDate as any,
      draftMode: draftMode as any,
      docPatches: finalDocPatches as any,
      extraDocuments: [] as any,
    } as any);

    setResultText(`Succeeded: ${res.succeeded}/${res.total} • Failed: ${res.failed}`);
    setResultOpen(true);
  };

  return (
    <Screen>
      <TemplatesHeader title="Otpremi" subtitle={`Template #${templateId}`} fallbackHref="/(tabs)/templates" />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {/* Mode */}
        <Text style={s.label}>Posting mode</Text>
        <Segmented<DraftMode>
          value={draftMode}
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "FINAL", label: "Final" },
          ]}
          onChange={setDraftMode}
        />

        {/* Partners */}
        <Pressable style={s.primary} onPress={() => setPartnerPickerOpen(true)}>
          <Text style={s.primaryText}>
            {selectedPartners.length === 0 ? "Select partners" : `Selected: ${selectedPartners.length}`}
          </Text>
        </Pressable>

        {/* Standalone extra items */}
        <View style={s.sectionHeader}>
          <Text style={s.label}>Extra items (not tied by you)</Text>
          <Pressable style={s.secondaryBtn} onPress={openStandaloneItems}>
            <Text style={s.secondaryText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={s.docCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.docTitle}>Standalone items</Text>
            <Text style={s.docSub}>Items: {qtyToItems(standaloneQty).length}</Text>

            {/* choose which doc they land into */}
            <View style={{ marginTop: 10, gap: 8 }}>
              <Text style={[s.docSub, { fontWeight: "900" }]}>Assign to document:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {templateDocs.map((d) => {
                  const docId = Number(d.documentId);
                  const active = Number(standaloneDocId ?? 0) === docId;
                  return (
                    <Pressable
                      key={String(docId)}
                      style={[s.docChip, active && s.docChipActive]}
                      onPress={() => setStandaloneDocId(docId)}
                    >
                      <Text style={[s.docChipText, active && s.docChipTextActive]}>#{docId}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Template docs add-items */}
        <Text style={s.label}>Template documents</Text>

        {tplQ.isLoading ? (
          <Text style={s.helper}>Loading template…</Text>
        ) : templateDocs.length === 0 ? (
          <Text style={s.helper}>Template has no documents.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {templateDocs.map((d) => {
              const docId = Number(d.documentId);
              const patch = patchByDocId.get(docId);
              const addedCount = patch?.addItems?.length ?? 0;

              return (
                <View key={String(d.id ?? d.documentId)} style={s.docCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docTitle}>Document #{docId}</Text>
                    <Text style={s.docSub}>
                      Template items: {d.items?.length ?? 0} • Added now: {addedCount}
                    </Text>
                  </View>

                  <Pressable style={s.smallBtn} onPress={() => openDocAddItems(docId)}>
                    <Text style={s.smallBtnText}>Add items</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[s.primary, (selectedPartners.length === 0 || !warehouseId) && { opacity: 0.5 }]}
          disabled={selectedPartners.length === 0 || !warehouseId}
          onPress={submit}
        >
          <Text style={s.primaryText}>{selectedPartners.length <= 1 ? "Create" : `Create (${selectedPartners.length})`}</Text>
        </Pressable>

        {/* Selected partners */}
        <Text style={s.label}>Selected partners</Text>
        <FlatList
          data={selectedPartners}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <View style={s.cardSelected}>
              <View style={s.checkDotSelected}>
                <Text style={s.checkDotTextSelected}>✓</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.name}</Text>
                <Text style={s.sub}>
                  #{item.partnerNumber} • {item.city}
                </Text>
              </View>

              <Pressable style={s.remove} onPress={() => togglePartner(item)}>
                <Text style={s.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>No partners selected.</Text>}
        />

        {/* Partner picker */}
        <SearchPickerSheet<PartnerResponseDTO>
          visible={partnerPickerOpen}
          title="Select partners"
          onClose={() => setPartnerPickerOpen(false)}
          keyOf={(p) => String(p.id)}
          fetchPage={async ({ page, size, q }) => {
            const res = await partnerService.pagePartners({ page, size, q: q ?? "" });
            return { items: res.items, page: res.page, size: res.size, total: res.total };
          }}
          renderRow={(p) => {
            const isSelected = selectedPartnerIds.has(normId(p.id));
            return (
              <Pressable style={[s.pickRow, isSelected && s.pickRowSelected]} onPress={() => togglePartner(p)}>
                <View style={s.pickLeft}>
                  <View style={[s.checkDot, isSelected && s.checkDotSelected]}>
                    <Text style={[s.checkDotText, isSelected && { color: "#fff" }]}>{isSelected ? "✓" : "+"}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.pickTitle}>{p.name}</Text>
                    <Text style={s.pickSub}>
                      #{p.partnerNumber} • {p.city}
                    </Text>
                  </View>
                </View>

                {isSelected && (
                  <View style={s.pill}>
                    <Text style={s.pillText}>Selected</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />

        {/* Item picker */}
        <Sheet visible={itemPickerOpen} title="Pick items" onClose={() => setItemPickerOpen(false)}>
          {!warehouseId ? (
            <Text style={s.helper}>Missing defaultWarehouseId in session.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={s.helper}>Tap to +1 • Long press to -1</Text>

              <SearchPickerSheet<ItemDescriptorResponseDTO>
                visible={true as any}
                title="Items"
                onClose={() => {}}
                keyOf={(it) => String(it.itemId)}
                fetchPage={async ({ page, size, q }) => {
                  const res = await itemDirectoryService.pageItems({
                    warehouseId,
                    page,
                    size,
                    q: q ?? "",
                  });
                  return { items: res.items, page: res.page, size: res.size, total: res.total };
                }}
                renderRow={(it) => {
                  const qv = Number(qtyDraft[String(it.itemId)] ?? 0);
                  return (
                    <Pressable
                      style={[s.itemRow, qv > 0 && s.itemRowSelected]}
                      onPress={() => setQtyDraft((cur) => upsertQty(cur, Number(it.itemId), 1))}
                      onLongPress={() => setQtyDraft((cur) => upsertQty(cur, Number(it.itemId), -1))}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.pickTitle}>
                          {it.code} • {it.name}
                        </Text>
                        <Text style={s.pickSub}>{it.unit}</Text>
                      </View>

                      <View style={[s.qtyPill, qv > 0 && s.qtyPillOn]}>
                        <Text style={s.qtyText}>{qv}</Text>
                      </View>
                    </Pressable>
                  );
                }}
              />

              <Pressable style={s.primary} onPress={applyPickedItems}>
                <Text style={s.primaryText}>Apply</Text>
              </Pressable>
            </View>
          )}
        </Sheet>

        {/* Result */}
        <Sheet visible={resultOpen} title="Result" onClose={() => setResultOpen(false)}>
          <Text style={{ fontWeight: "900", color: Colors.text }}>{resultText}</Text>
          <Pressable style={s.primary} onPress={() => setResultOpen(false)}>
            <Text style={s.primaryText}>OK</Text>
          </Pressable>
        </Sheet>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  label: { fontWeight: "900", color: Colors.text },
  helper: { color: Colors.sub, fontWeight: "800" },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  secondaryText: { fontWeight: "900", color: Colors.text },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  docCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docTitle: { fontWeight: "900", color: Colors.text },
  docSub: { color: Colors.sub, fontWeight: "800" },

  docChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  docChipActive: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  docChipText: { fontWeight: "900", color: Colors.sub },
  docChipTextActive: { color: Colors.text },

  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },

  // Selected partners cards
  cardSelected: {
    backgroundColor: "rgba(249,115,22,0.10)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.orange,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "800" },

  remove: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.dangerBg },
  removeText: { fontWeight: "900", color: Colors.dangerText },

  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 12 },

  // Picker rows
  pickRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pickRowSelected: { borderColor: Colors.orange, backgroundColor: "rgba(249,115,22,0.10)" },
  pickLeft: { flexDirection: "row", gap: 10, alignItems: "center", flex: 1 },

  checkDot: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDotSelected: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDotText: { fontWeight: "900", color: Colors.text },
  checkDotTextSelected: { fontWeight: "900", color: "#fff" },

  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "800" },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.35)",
  },
  pillText: { fontWeight: "900", color: Colors.text },

  // Items
  itemRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  itemRowSelected: {
    borderColor: Colors.orange,
    backgroundColor: "rgba(249,115,22,0.10)",
  },
  qtyPill: {
    minWidth: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyPillOn: { borderColor: Colors.orange, backgroundColor: "rgba(249,115,22,0.12)" },
  qtyText: { fontWeight: "900", color: Colors.text },
});
