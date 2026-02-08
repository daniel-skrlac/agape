import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  DraftMode,
  PartnerResponseDTO,
  TemplateResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  ItemDescriptorResponseDTO,
} from "@/app/models/generated";

import { partnerService } from "@/app/api/services/partnerService";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";

import {
  useBookingSession,
  useDeleteBookingSessionEntry,
  useFinalizeBookingSession,
  useUpsertBookingSessionEntry,
} from "@/app/api/hooks/useBookingSessions";

import { useTemplateList } from "@/app/api/hooks/useDispatchTemplates";

const MAX_W = 560;

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

function mkPatch(docId: number, addItems: TemplateBookItemDTO[]): TemplateBookDocPatchDTO {
  return {
    documentId: docId,
    addItems,
    setItems: [],
    removeItemIds: [],
    draftOverride: null as any,
    noteOverride: null as any,
  } as any;
}

function badgeStyle(status: any) {
  if (status === "FINALIZED") return { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.35)" };
  if (status === "CANCELLED") return { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.35)" };
  return { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" };
}

function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

function Header({ title }: { title: string }) {
  return (
    <View style={s.header}>
      <Pressable style={s.iconBtn} onPress={() => router.back()} hitSlop={10}>
        <FontAwesome name="chevron-left" size={18} color={Colors.text} />
      </Pressable>

      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      <View style={{ width: 38 }} />
    </View>
  );
}

export default function SessionDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const upsertM = useUpsertBookingSessionEntry(sessionId);
  const delEntryM = useDeleteBookingSessionEntry(sessionId);
  const finalizeM = useFinalizeBookingSession(sessionId);

  const err =
    (sQ.error as any)?.message ||
    (upsertM.error as any)?.message ||
    (delEntryM.error as any)?.message ||
    (finalizeM.error as any)?.message ||
    null;

  // partner picker
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);

  // editor (CenterSheet)
  const [editOpen, setEditOpen] = useState(false);
  const [entry, setEntry] = useState<BookingSessionEntryResponseDTO | null>(null);

  const [draftMode, setDraftMode] = useState<DraftMode>("DRAFT");
  const [templateId, setTemplateId] = useState<number | null>(null);

  const [docPatches, setDocPatches] = useState<TemplateBookDocPatchDTO[]>([]);
  const [standaloneDocId, setStandaloneDocId] = useState<number | null>(null);
  const [standaloneQty, setStandaloneQty] = useState<QtyMap>({});

  // template picker (CenterSheet)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateQ, setTemplateQ] = useState("");
  const tplListQ = useTemplateList({ folderId: null, q: templateQ, includeShared: true, rootOnly: true });

  // items picker (CenterSheet)
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemTarget, setItemTarget] = useState<{ kind: "DOC"; documentId: number } | { kind: "STANDALONE" } | null>(null);
  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});

  const patchByDocId = useMemo(() => {
    const m = new Map<number, TemplateBookDocPatchDTO>();
    (docPatches ?? []).forEach((p) => m.set(Number(p.documentId), p));
    return m;
  }, [docPatches]);

  // debounce search
  const [templateQDeb, setTemplateQDeb] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTemplateQDeb(templateQ.trim()), 200);
    return () => clearTimeout(t);
  }, [templateQ]);

  const selectedTemplate: TemplateResponseDTO | null = useMemo(() => {
    const list = (tplListQ.data ?? []) as any as TemplateResponseDTO[];
    const id = templateId ?? Number(entry?.templateId ?? 0);
    if (!id) return null;
    return list.find((t) => Number(t.id) === Number(id)) ?? null;
  }, [tplListQ.data, templateId, entry?.templateId]);

  const templateDocs = (selectedTemplate?.documents ?? []) as any[];

  const startCreateForPartner = (p: PartnerResponseDTO) => {
    if (!session || session.status !== "DRAFT") return;

    const e: BookingSessionEntryResponseDTO = {
      id: 0 as any,
      partnerId: p.id,
      templateId: 0 as any,
      draftMode: "DRAFT",
      documentDate: null as any,
      docPatches: [] as any,
      extraDocuments: [] as any,
      note: null as any,
    } as any;

    setEntry(e);
    setDraftMode("DRAFT");
    setTemplateId(null);
    setDocPatches([]);
    setStandaloneDocId(null);
    setStandaloneQty({});
    setEditOpen(true);
  };

  const startEdit = (e: BookingSessionEntryResponseDTO) => {
    if (!session || session.status !== "DRAFT") return;

    setEntry(e);
    setDraftMode(e.draftMode ?? "DRAFT");
    setTemplateId(Number(e.templateId) || null);

    const patches = (e.docPatches ?? []) as any;
    setDocPatches(Array.isArray(patches) ? (patches as any) : []);

    setStandaloneDocId(null);
    setStandaloneQty({});
    setEditOpen(true);
  };

  const openDocItems = (documentId: number) => {
    const p = patchByDocId.get(Number(documentId));
    const m: QtyMap = {};
    (p?.addItems ?? []).forEach((it: any) => (m[String(it.itemId)] = Number(it.quantity ?? 0)));
    setQtyDraft(m);
    setItemTarget({ kind: "DOC", documentId });
    setItemPickerOpen(true);
  };

  const openStandaloneItems = () => {
    setQtyDraft({ ...standaloneQty });
    setItemTarget({ kind: "STANDALONE" });
    setItemPickerOpen(true);
  };

  const applyItems = () => {
    if (!itemTarget) return;
    const items = qtyToItems(qtyDraft);

    if (itemTarget.kind === "DOC") {
      const docId = Number(itemTarget.documentId);
      const next = [...docPatches];
      const idx = next.findIndex((p) => Number(p.documentId) === docId);

      if (items.length === 0) {
        if (idx >= 0) next.splice(idx, 1);
      } else {
        if (idx === -1) next.push(mkPatch(docId, items));
        else next[idx] = { ...next[idx], addItems: items as any };
      }
      setDocPatches(next);
    } else {
      setStandaloneQty(qtyDraft);
    }

    setItemPickerOpen(false);
  };

  const buildDocPatchesWithStandalone = () => {
    const standaloneItems = qtyToItems(standaloneQty);
    if (standaloneItems.length === 0) return docPatches;

    const docId = standaloneDocId ?? Number(templateDocs?.[0]?.documentId ?? 0);
    if (!docId) return docPatches;

    const next = [...docPatches];
    const idx = next.findIndex((p) => Number(p.documentId) === docId);

    if (idx === -1) return [...next, mkPatch(docId, standaloneItems)];

    const cur = next[idx]?.addItems ?? [];
    const by = new Map<number, number>();
    [...cur, ...standaloneItems].forEach((x: any) => {
      const id = Number(x.itemId);
      const q = Number(x.quantity ?? 0);
      if (!id || q <= 0) return;
      by.set(id, (by.get(id) ?? 0) + q);
    });

    next[idx] = {
      ...next[idx],
      addItems: Array.from(by.entries()).map(([itemId, quantity]) => ({ itemId, quantity })) as any,
    };

    return next;
  };

  const save = async () => {
    if (!session || session.status !== "DRAFT") return;
    if (!entry) return;
    if (!templateId || templateId <= 0) return;

    const payload: BookingSessionEntryUpsertRequestDTO = {
      partnerId: Number(entry.partnerId),
      templateId: Number(templateId),
      draftMode: draftMode as any,
      documentDate: entry.documentDate ?? null,
      docPatches: buildDocPatchesWithStandalone() as any,
      extraDocuments: [] as any,
      note: entry.note ?? null,
    } as any;

    await upsertM.mutateAsync(payload);
    setEditOpen(false);
    setEntry(null);
    sQ.refetch();
  };

  const deleteEntry = async (entryId: number) => {
    await delEntryM.mutateAsync(entryId);
    sQ.refetch();
  };

  const finalize = async () => {
    await finalizeM.mutateAsync();
    sQ.refetch();
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <View style={s.container}>
        <Header title="Evidencija" />

        {!!err && <Banner type="error" text={String(err)} />}

        {!session ? (
          <View style={s.center}>
            {sQ.isLoading ? <ActivityIndicator /> : null}
            <Text style={s.helper}>{sQ.isLoading ? "Učitavam…" : "Evidencija nije pronađena."}</Text>
          </View>
        ) : (
          <>
            <View style={s.heroCard}>
              <Text style={s.h1}>{session.title}</Text>
              {!!session.note && <Text style={s.sub}>{session.note}</Text>}

              <View style={s.metaLine}>
                <View style={[s.badge, badgeStyle(session.status)]}>
                  <Text style={s.badgeText}>{statusHr(session.status)}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FontAwesome name="home" size={14} color={Colors.sub} />
                  <Text style={s.sub}>Skladište #{session.warehouseId}</Text>
                </View>
              </View>

              {session.status === "DRAFT" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable style={s.addBtnWide} onPress={() => setPartnerPickerOpen(true)}>
                    <Text style={s.addBtnText}>+ Dodaj partnera</Text>
                  </Pressable>

                  <Pressable
                    style={[s.finalizeBtn, finalizeM.isPending && { opacity: 0.6 }]}
                    onPress={finalize}
                    disabled={finalizeM.isPending}
                  >
                    {finalizeM.isPending ? <ActivityIndicator /> : <Text style={s.finalizeText}>Finaliziraj</Text>}
                  </Pressable>
                </View>
              ) : (
                !!(session as any).finalResult && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.label}>Rezultat</Text>
                    <Text style={s.sub}>
                      Ukupno: {(session as any).finalResult?.total ?? "?"} • Uspjelo: {(session as any).finalResult?.succeeded ?? "?"} • Neuspjelo:{" "}
                      {(session as any).finalResult?.failed ?? "?"}
                    </Text>
                  </View>
                )
              )}
            </View>

            <Text style={s.label}>Stavke evidencije</Text>

            <FlatList
              data={(session.entries ?? []) as BookingSessionEntryResponseDTO[]}
              keyExtractor={(x) => String(x.id)}
              contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
              ListEmptyComponent={<Text style={s.helper}>Nema unosa.</Text>}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.title}>Partner #{item.partnerId}</Text>

                    <View style={[s.badge, badgeStyle(item.draftMode === "FINAL" ? "FINALIZED" : "DRAFT")]}>
                      <Text style={s.badgeText}>{item.draftMode === "FINAL" ? "FINAL" : "DRAFT"}</Text>
                    </View>
                  </View>

                  <Text style={s.sub}>Predložak #{item.templateId || "—"}</Text>

                  <View style={s.rowBtns}>
                    <Pressable
                      style={[s.smallBtn, session.status !== "DRAFT" && { opacity: 0.5 }]}
                      disabled={session.status !== "DRAFT"}
                      onPress={() => startEdit(item)}
                    >
                      <Text style={s.smallBtnText}>Uredi</Text>
                    </Pressable>

                    <Pressable
                      style={[s.smallBtn, { backgroundColor: Colors.dangerBg }, session.status !== "DRAFT" && { opacity: 0.5 }]}
                      disabled={session.status !== "DRAFT" || delEntryM.isPending}
                      onPress={() => deleteEntry(Number(item.id))}
                    >
                      <Text style={[s.smallBtnText, { color: Colors.dangerText }]}>{delEntryM.isPending ? "…" : "Obriši"}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </>
        )}

        {/* Partner picker */}
        <SearchPickerSheet<PartnerResponseDTO>
          visible={partnerPickerOpen}
          title="Odaberi partnera"
          onClose={() => setPartnerPickerOpen(false)}
          keyOf={(p) => String(p.id)}
          fetchPage={async ({ page, size, q }) => {
            const res = await partnerService.pagePartners({ page, size, q: q ?? "" });
            return { items: res.items, page: res.page, size: res.size, total: res.total };
          }}
          renderRow={(p) => (
            <Pressable
              style={s.pickRow}
              onPress={() => {
                setPartnerPickerOpen(false);
                startCreateForPartner(p);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.pickTitle}>{p.name}</Text>
                <Text style={s.pickSub}>
                  #{p.partnerNumber} • {p.city}
                </Text>
              </View>
            </Pressable>
          )}
        />

        {/* Editor */}
        <CenterSheet
          visible={editOpen}
          title={entry ? `Unos: Partner #${entry.partnerId}` : "Unos"}
          width={MAX_W}
          closeOnBackdrop={false}
          disableClose={upsertM.isPending}
          onClose={() => {
            if (upsertM.isPending) return;
            setEditOpen(false);
          }}
        >
          {!entry ? null : (
            <View style={{ gap: 12 }}>
              <Text style={s.label}>Način</Text>
              <Segmented<DraftMode>
                value={draftMode}
                options={[
                  { value: "DRAFT", label: "Draft" },
                  { value: "FINAL", label: "Final" },
                ]}
                onChange={setDraftMode}
              />

              <Text style={s.label}>Predložak</Text>
              <Pressable style={s.secondaryBtn} onPress={() => setTemplatePickerOpen(true)}>
                <Text style={s.secondaryText}>{templateId ? `Predložak #${templateId}` : "Odaberi predložak"}</Text>
              </Pressable>

              <View style={s.sectionHeader}>
                <Text style={s.label}>Dodatne stavke</Text>
                <Pressable style={s.secondaryBtn} onPress={() => {
                  setQtyDraft({ ...standaloneQty });
                  setItemTarget({ kind: "STANDALONE" });
                  setItemPickerOpen(true);
                }}>
                  <Text style={s.secondaryText}>+ Dodaj</Text>
                </Pressable>
              </View>

              <View style={s.docCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>Samostalne stavke</Text>
                  <Text style={s.docSub}>Stavki: {qtyToItems(standaloneQty).length}</Text>

                  {!!templateDocs?.length && (
                    <>
                      <Text style={[s.docSub, { fontWeight: "900", marginTop: 10 }]}>Dodijeli dokumentu:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {templateDocs.map((d: any) => {
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
                    </>
                  )}
                </View>
              </View>

              <Text style={s.label}>Dokumenti</Text>
              {!templateId ? (
                <Text style={s.helper}>Prvo odaberi predložak.</Text>
              ) : templateDocs.length === 0 ? (
                <Text style={s.helper}>Predložak nema dokumenata.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {templateDocs.map((d: any) => {
                    const docId = Number(d.documentId);
                    const p = patchByDocId.get(docId);
                    const added = p?.addItems?.length ?? 0;

                    return (
                      <View key={String(docId)} style={s.docCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.docTitle}>Dokument #{docId}</Text>
                          <Text style={s.docSub}>Dodano: {added}</Text>
                        </View>

                        <Pressable
                          style={s.smallBtn}
                          onPress={() => {
                            const p = patchByDocId.get(Number(docId));
                            const m: QtyMap = {};
                            (p?.addItems ?? []).forEach((it: any) => (m[String(it.itemId)] = Number(it.quantity ?? 0)));
                            setQtyDraft(m);
                            setItemTarget({ kind: "DOC", documentId: docId });
                            setItemPickerOpen(true);
                          }}
                        >
                          <Text style={s.smallBtnText}>Dodaj stavke</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              <Pressable style={[s.primaryBtn, (!templateId || upsertM.isPending) && { opacity: 0.5 }]} disabled={!templateId || upsertM.isPending} onPress={save}>
                {upsertM.isPending ? <ActivityIndicator /> : <Text style={s.primaryText}>Spremi</Text>}
              </Pressable>

              <Pressable style={[s.secondaryBtn, upsertM.isPending && { opacity: 0.5 }]} disabled={upsertM.isPending} onPress={() => setEditOpen(false)}>
                <Text style={s.secondaryText}>Zatvori</Text>
              </Pressable>
            </View>
          )}
        </CenterSheet>

        {/* Template picker */}
        <CenterSheet visible={templatePickerOpen} title="Odaberi predložak" width={MAX_W} closeOnBackdrop={true} onClose={() => setTemplatePickerOpen(false)}>
          <View style={{ gap: 10 }}>
            <View style={s.searchWrap}>
              <FontAwesome name="search" size={14} color={Colors.sub} />
              <TextInput
                value={templateQ}
                onChangeText={setTemplateQ}
                placeholder="Pretraži predloške…"
                placeholderTextColor={Colors.sub}
                style={s.search}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {!!templateQ && (
                <Pressable onPress={() => setTemplateQ("")} hitSlop={8}>
                  <FontAwesome name="times-circle" size={16} color={Colors.sub} />
                </Pressable>
              )}
            </View>

            {tplListQ.isLoading ? (
              <View style={s.center}>
                <ActivityIndicator />
                <Text style={s.helper}>Učitavam predloške…</Text>
              </View>
            ) : (
              <FlatList
                data={(tplListQ.data ?? []) as any as TemplateResponseDTO[]}
                keyExtractor={(t) => String(t.id)}
                contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
                renderItem={({ item: t }) => {
                  const needle = templateQDeb.toLowerCase();
                  const ok = !needle || (t.name ?? "").toLowerCase().includes(needle) || String(t.id).includes(needle);
                  if (!ok) return null;

                  return (
                    <Pressable
                      style={s.pickRow}
                      onPress={() => {
                        setTemplateId(Number(t.id));
                        setDocPatches([]);
                        setStandaloneDocId(null);
                        setTemplatePickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.pickTitle}>{t.name}</Text>
                        <Text style={s.pickSub}>#{t.id} • dokumenata: {t.documents?.length ?? 0}</Text>
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={s.helper}>Nema predložaka.</Text>}
              />
            )}

            <Pressable style={s.secondaryBtn} onPress={() => setTemplatePickerOpen(false)}>
              <Text style={s.secondaryText}>Zatvori</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* Items picker */}
        <CenterSheet visible={itemPickerOpen} title="Odaberi stavke" width={MAX_W} closeOnBackdrop={false} onClose={() => setItemPickerOpen(false)}>
          <View style={{ gap: 12 }}>
            <Text style={s.helper}>Tap = +1 • Long press = -1</Text>

            <SearchPickerSheet<ItemDescriptorResponseDTO>
              visible={true as any}
              title="Stavke"
              onClose={() => {}}
              keyOf={(it) => String(it.itemId)}
              fetchPage={async ({ page, size, q }) => {
                if (!session?.warehouseId) return { items: [], page, size, total: 0 };
                const res = await itemDirectoryService.pageItems({
                  warehouseId: Number(session.warehouseId),
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

            <Pressable
              style={s.primaryBtn}
              onPress={() => {
                if (!itemTarget) return;

                const items = qtyToItems(qtyDraft);

                if (itemTarget.kind === "DOC") {
                  const docId = Number(itemTarget.documentId);
                  const next = [...docPatches];
                  const idx = next.findIndex((p) => Number(p.documentId) === docId);

                  if (items.length === 0) {
                    if (idx >= 0) next.splice(idx, 1);
                  } else {
                    if (idx === -1) next.push(mkPatch(docId, items));
                    else next[idx] = { ...next[idx], addItems: items as any };
                  }
                  setDocPatches(next);
                } else {
                  setStandaloneQty(qtyDraft);
                }

                setItemPickerOpen(false);
              }}
            >
              <Text style={s.primaryText}>Primijeni</Text>
            </Pressable>

            <Pressable style={s.secondaryBtn} onPress={() => setItemPickerOpen(false)}>
              <Text style={s.secondaryText}>Zatvori</Text>
            </Pressable>
          </View>
        </CenterSheet>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerTitle: { fontWeight: "900", color: Colors.text, fontSize: 20, flex: 1, textAlign: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg,
  },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 10 },

  heroCard: {
    backgroundColor: Colors.bg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  h1: { fontWeight: "900", color: Colors.text, fontSize: 18 },

  label: { fontWeight: "900", color: Colors.text },
  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "800" },

  metaLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 },

  // buttons
  addBtnWide: { flex: 1, height: 38, borderRadius: 999, backgroundColor: Colors.orange, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "900" },

  finalizeBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  finalizeText: { fontWeight: "900", color: Colors.text },

  primaryBtn: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },

  rowBtns: { flexDirection: "row", gap: 10 },

  smallBtn: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },

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
  docChipActive: { borderColor: Colors.orange, backgroundColor: "rgba(249,115,22,0.12)" },
  docChipText: { fontWeight: "900", color: Colors.sub },
  docChipTextActive: { color: Colors.text },

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
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "800" },

  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: { flex: 1, fontWeight: "800", color: Colors.text },

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
  itemRowSelected: { borderColor: Colors.orange, backgroundColor: "rgba(249,115,22,0.10)" },
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
