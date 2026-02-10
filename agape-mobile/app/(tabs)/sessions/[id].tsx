// app/(tabs)/sessions/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import TemplatesHeader from "@/app/(tabs)/templates/TemplatesHeader";

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
import { dispatchTemplateService } from "@/app/api/services/dispatchTemplateService";

import {
  useBookingSession,
  useDeleteBookingSessionEntry,
  useFinalizeBookingSession,
  useUpsertBookingSessionEntry,
} from "@/app/api/hooks/useBookingSessions";

const MAX_W = 560;
const ITEMS_PAGE_SIZE = 12;

type QtyMap = Record<string, number>;

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  )
    return s.slice(1, -1);
  return s;
}
function cleanDescription(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  const s = cleanText(v).trim();
  if (!s) return null;
  if (s.replace(/\s/g, "") === "[]") return null;
  return s;
}

function badgeStyle(status: any) {
  if (status === "FINALIZED")
    return { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.35)" };
  if (status === "CANCELLED")
    return { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.35)" };
  return { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" };
}
function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

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

// ✅ Center modal bez animacije, s ispravnim layeringom (da ne blokira touch nakon close)
function CenterModal(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  disableClose?: boolean;
}) {
  const { visible, title, onClose, children, disableClose } = props;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={disableClose ? undefined : onClose}
    >
      <View style={st.modalWrap}>
        <Pressable style={st.backdrop} onPress={disableClose ? undefined : onClose} />

        <View style={st.modalCard} pointerEvents="auto">
          <View style={st.modalHeader}>
            <Text style={st.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              style={[st.iconBtn, disableClose && { opacity: 0.5 }]}
              onPress={disableClose ? undefined : onClose}
              disabled={disableClose}
            >
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={st.modalBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
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

  const headerTitle = cleanText((session as any)?.title) || "";

  // partner cache
  const [partnerById, setPartnerById] = useState<Record<string, PartnerResponseDTO>>({});
  const partnerLabel = (partnerId: number | null | undefined) => {
    const p = partnerId ? partnerById[String(partnerId)] : null;
    if (p?.name) return `${p.name} (#${(p as any).id})`;
    return partnerId ? `Partner #${partnerId}` : "Partner";
  };

  // pickers + modals
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [entry, setEntry] = useState<BookingSessionEntryResponseDTO | null>(null);

  const [draftMode, setDraftMode] = useState<DraftMode>("DRAFT");

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateResponseDTO | null>(null);

  // doc patches + standalone
  const [docPatches, setDocPatches] = useState<TemplateBookDocPatchDTO[]>([]);
  const [standaloneDocId, setStandaloneDocId] = useState<number | null>(null);
  const [standaloneQty, setStandaloneQty] = useState<QtyMap>({});

  // items modal
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemTarget, setItemTarget] = useState<
    { kind: "DOC"; documentId: number } | { kind: "STANDALONE" } | null
  >(null);

  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});
  const [itemsTab, setItemsTab] = useState<"results" | "added">("results");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [itemsPage, setItemsPage] = useState(0);

  useEffect(() => {
    const tt = setTimeout(() => setDebouncedQ(searchQ.trim()), 220);
    return () => clearTimeout(tt);
  }, [searchQ]);

  useEffect(() => {
    setItemsPage(0);
  }, [debouncedQ]);

  // delete entry confirm
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [deletePartnerId, setDeletePartnerId] = useState<number | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<string>("");

  const patchByDocId = useMemo(() => {
    const m = new Map<number, TemplateBookDocPatchDTO>();
    (docPatches ?? []).forEach((p) => m.set(Number((p as any).documentId), p));
    return m;
  }, [docPatches]);

  const templateDocs = useMemo(
    () => ((selectedTemplate as any)?.documents ?? []) as any[],
    [selectedTemplate]
  );

  // prefetch partner names (za listu)
  useEffect(() => {
    const ids = (session?.entries ?? [])
      .map((e: any) => Number(e.partnerId))
      .filter(Boolean);

    const missing = ids.filter((id) => !partnerById[String(id)]);
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      for (const id of missing.slice(0, 25)) {
        try {
          const res = await partnerService.pagePartners({ page: 0, size: 10, q: String(id) });
          const hit = (res.items ?? []).find((p: any) => Number(p.id) === Number(id)) ?? null;
          if (!hit) continue;
          if (cancelled) return;
          setPartnerById((cur) => ({ ...cur, [String((hit as any).id)]: hit }));
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.id, (session?.entries ?? []).length]);

  const resetEditorState = () => {
    setSelectedTemplate(null);
    setDocPatches([]);
    setStandaloneDocId(null);
    setStandaloneQty({});
  };

  const startCreateForPartner = (p: PartnerResponseDTO) => {
    if (!session || (session as any).status !== "DRAFT") return;

    setPartnerById((cur) => ({ ...cur, [String((p as any).id)]: p }));

    const e: BookingSessionEntryResponseDTO = {
      id: 0 as any,
      partnerId: (p as any).id,
      templateId: 0 as any,
      draftMode: "DRAFT",
      documentDate: null as any,
      docPatches: [] as any,
      extraItems: [] as any,
      note: null as any,
    } as any;

    setEntry(e);
    setDraftMode("DRAFT");
    resetEditorState();

    // ✅ bitno: open editor u idućem ticku ako dolazi iz modala
    setTimeout(() => setEditOpen(true), 0);
  };

  const startEdit = async (e: BookingSessionEntryResponseDTO) => {
    if (!session || (session as any).status !== "DRAFT") return;

    setEntry(e);
    setDraftMode(((e as any).draftMode ?? "DRAFT") as any);

    const patches = ((e as any).docPatches ?? []) as any;
    setDocPatches(Array.isArray(patches) ? patches : []);
    setStandaloneDocId(null);
    setStandaloneQty({});

    const tplId = Number((e as any).templateId || 0);
    if (tplId) {
      try {
        const tpl = await dispatchTemplateService.getTemplate(tplId);
        setSelectedTemplate(tpl as any);
      } catch {
        setSelectedTemplate(null);
      }
    } else {
      setSelectedTemplate(null);
    }

    setTimeout(() => setEditOpen(true), 0);
  };

  const openDocItems = (documentId: number) => {
    const p = patchByDocId.get(Number(documentId));
    const m: QtyMap = {};
    ((p as any)?.addItems ?? []).forEach(
      (it: any) => (m[String(it.itemId)] = Number(it.quantity ?? 0))
    );

    setQtyDraft(m);
    setItemTarget({ kind: "DOC", documentId });

    setItemsTab("results");
    setSearchQ("");
    setDebouncedQ("");
    setItemsPage(0);

    // ✅ open u idućem ticku (sprječava ghost overlay kad klikneš iz edit modala)
    setTimeout(() => setItemsOpen(true), 0);
  };

  const openStandaloneItems = () => {
    setQtyDraft({ ...standaloneQty });
    setItemTarget({ kind: "STANDALONE" });

    setItemsTab("results");
    setSearchQ("");
    setDebouncedQ("");
    setItemsPage(0);

    setTimeout(() => setItemsOpen(true), 0);
  };

  // items paging fetch
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsRows, setItemsRows] = useState<ItemDescriptorResponseDTO[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);

  useEffect(() => {
    if (!itemsOpen) return;
    let alive = true;

    (async () => {
      setItemsLoading(true);
      try {
        if (!session?.warehouseId) {
          if (!alive) return;
          setItemsRows([]);
          setItemsTotal(0);
          return;
        }

        const res = await itemDirectoryService.pageItems({
          warehouseId: Number((session as any).warehouseId),
          page: itemsPage,
          size: ITEMS_PAGE_SIZE,
          q: debouncedQ || "",
        });

        if (!alive) return;
        setItemsRows((res.items ?? []) as any);
        setItemsTotal(Number((res as any).total ?? 0));
      } catch {
        if (!alive) return;
        setItemsRows([]);
        setItemsTotal(0);
      } finally {
        if (!alive) return;
        setItemsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [itemsOpen, session?.warehouseId, itemsPage, debouncedQ]);

  const itemsTotalPages = Math.max(1, Math.ceil((itemsTotal || 0) / ITEMS_PAGE_SIZE));
  const canPrev = itemsPage > 0;
  const canNext = itemsPage + 1 < itemsTotalPages;

  const applyItems = () => {
    if (!itemTarget) return;
    const items = qtyToItems(qtyDraft);

    if (itemTarget.kind === "DOC") {
      const docId = Number(itemTarget.documentId);
      const next = [...docPatches];
      const idx = next.findIndex((p) => Number((p as any).documentId) === docId);

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

    setItemsOpen(false);
  };

  const buildDocPatchesWithStandalone = () => {
    const standaloneItems = qtyToItems(standaloneQty);
    if (standaloneItems.length === 0) return docPatches;

    const docId =
      standaloneDocId ??
      Number(
        (templateDocs?.[0] as any)?.documentId ??
          (templateDocs?.[0] as any)?.document_id ??
          0
      );

    if (!docId) return docPatches;

    const next = [...docPatches];
    const idx = next.findIndex((p) => Number((p as any).documentId) === docId);
    if (idx === -1) return [...next, mkPatch(docId, standaloneItems)];

    const cur = ((next[idx] as any)?.addItems ?? []) as any[];
    const by = new Map<number, number>();

    [...cur, ...standaloneItems].forEach((x: any) => {
      const id = Number(x.itemId);
      const q = Number(x.quantity ?? 0);
      if (!id || q <= 0) return;
      by.set(id, (by.get(id) ?? 0) + q);
    });

    next[idx] = {
      ...(next[idx] as any),
      addItems: Array.from(by.entries()).map(([itemId, quantity]) => ({ itemId, quantity })) as any,
    } as any;

    return next;
  };

  const save = async () => {
    if (!session || (session as any).status !== "DRAFT") return;
    if (!entry) return;

    const tplId = Number((selectedTemplate as any)?.id ?? 0);
    if (!tplId) return;

    const payload: BookingSessionEntryUpsertRequestDTO = {
      partnerId: Number((entry as any).partnerId),
      templateId: tplId,
      draftMode: draftMode as any,
      documentDate: (entry as any).documentDate ?? null,
      docPatches: buildDocPatchesWithStandalone() as any,
      extraItems: [] as any,
      note: (entry as any).note ?? null,
    } as any;

    await upsertM.mutateAsync(payload);
    setEditOpen(false);
    setEntry(null);
    await sQ.refetch();
  };

  const askDeleteEntry = (e: BookingSessionEntryResponseDTO) => {
    const pid = Number((e as any).partnerId);
    setDeletePartnerId(pid);
    setDeleteLabel(partnerLabel(pid));
    setDeleteEntryOpen(true);
  };

  const deleteEntry = async () => {
    if (!deletePartnerId) return;
    await delEntryM.mutateAsync(Number(deletePartnerId));
    setDeleteEntryOpen(false);
    setDeletePartnerId(null);
    await sQ.refetch();
  };

  const finalize = async () => {
    await finalizeM.mutateAsync();
    await sQ.refetch();
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TemplatesHeader title={headerTitle} fallbackHref="/(tabs)/sessions" />

      <View style={st.container}>
        {!!err && <Banner type="error" text={String(err)} />}

        {!session ? (
          <View style={st.center}>
            {sQ.isLoading ? <ActivityIndicator /> : null}
            <Text style={st.helper}>{sQ.isLoading ? "Učitavam…" : "Nije pronađeno."}</Text>
          </View>
        ) : (
          <>
            <View style={st.heroCard}>
              {!!cleanDescription((session as any).note) && (
                <Text style={st.sub}>{cleanDescription((session as any).note)}</Text>
              )}

              <View style={st.metaLine}>
                <View style={[st.badge, badgeStyle((session as any).status)]}>
                  <Text style={st.badgeText}>{statusHr((session as any).status)}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FontAwesome name="home" size={14} color={Colors.sub} />
                  <Text style={st.sub}>Skladište #{(session as any).warehouseId}</Text>
                </View>
              </View>

              {(session as any).status === "DRAFT" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable style={st.primaryPill} onPress={() => setPartnerPickerOpen(true)}>
                    <Text style={st.primaryPillText}>+ Dodaj partnera</Text>
                  </Pressable>

                  <Pressable
                    style={[st.ghostPill, finalizeM.isPending && { opacity: 0.7 }]}
                    onPress={finalize}
                    disabled={finalizeM.isPending}
                  >
                    <Text style={st.ghostPillText}>{finalizeM.isPending ? "…" : "Finaliziraj"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <FlatList
              data={((session as any).entries ?? []) as BookingSessionEntryResponseDTO[]}
              keyExtractor={(x) => String((x as any).id)}
              contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
              ListEmptyComponent={<Text style={st.helper}>Nema unosa.</Text>}
              renderItem={({ item }) => {
                const pid = Number((item as any).partnerId);
                const tplId = Number((item as any).templateId || 0);
                const dm = (item as any).draftMode;

                return (
                  <View style={st.card}>
                    <View style={st.cardTop}>
                      <Text style={st.title} numberOfLines={1}>
                        {partnerLabel(pid)}
                      </Text>

                      <View style={[st.badge, badgeStyle(dm === "FINAL" ? "FINALIZED" : "DRAFT")]}>
                        <Text style={st.badgeText}>{dm === "FINAL" ? "FINAL" : "DRAFT"}</Text>
                      </View>
                    </View>

                    <Text style={st.sub}>Predložak: {tplId ? `#${tplId}` : "—"}</Text>

                    <View style={st.rowBtns}>
                      <Pressable
                        style={[
                          st.primaryPill,
                          (session as any).status !== "DRAFT" && { opacity: 0.5 },
                        ]}
                        disabled={(session as any).status !== "DRAFT"}
                        onPress={() => startEdit(item)}
                      >
                        <Text style={st.primaryPillText}>Otvori</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          st.dangerPill,
                          (session as any).status !== "DRAFT" && { opacity: 0.5 },
                        ]}
                        disabled={(session as any).status !== "DRAFT" || delEntryM.isPending}
                        onPress={() => askDeleteEntry(item)}
                      >
                        <Text style={st.dangerPillText}>{delEntryM.isPending ? "…" : "Obriši"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          </>
        )}

        {/* Partner picker (TVOJ SearchPickerSheet) */}
        <SearchPickerSheet<PartnerResponseDTO>
          visible={partnerPickerOpen}
          title="Odaberi partnera"
          onClose={() => setPartnerPickerOpen(false)}
          keyOf={(p) => String((p as any).id)}
          fetchPage={async ({ page, size, q }) => {
            const res = await partnerService.pagePartners({ page, size, q: q ?? "" });
            return { items: res.items, page: res.page, size: res.size, total: res.total };
          }}
          renderRow={(p, close) => (
            <Pressable
              style={st.pickRow}
              onPress={() => {
                // ✅ ključni fix: zatvori modal, pa tek onda otvori editor u idućem ticku
                close();
                setPartnerPickerOpen(false);
                setTimeout(() => startCreateForPartner(p), 0);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={st.pickTitle}>{(p as any).name}</Text>
                <Text style={st.pickSub}>
                  #{(p as any).partnerNumber} • {(p as any).city}
                </Text>
              </View>
            </Pressable>
          )}
          searchPlaceholder="Pretraži partnere…"
          closeOnBackdropPress={false}
        />

        {/* Editor modal */}
        <CenterModal
          visible={editOpen}
          title={entry ? `Unos • ${partnerLabel(Number((entry as any).partnerId))}` : "Unos"}
          disableClose={upsertM.isPending}
          onClose={() => {
            if (upsertM.isPending) return;
            setEditOpen(false);
            setEntry(null);
          }}
        >
          {!entry ? null : (
            <View style={{ width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 12 }}>
              <Text style={st.label}>Način</Text>

              <View style={st.segmentRow}>
                <Pressable
                  style={[st.segBtn, draftMode === "DRAFT" && st.segBtnOn]}
                  onPress={() => setDraftMode("DRAFT")}
                >
                  <Text style={[st.segText, draftMode === "DRAFT" && st.segTextOn]}>Draft</Text>
                </Pressable>

                <Pressable
                  style={[st.segBtn, draftMode === "FINAL" && st.segBtnOn]}
                  onPress={() => setDraftMode("FINAL")}
                >
                  <Text style={[st.segText, draftMode === "FINAL" && st.segTextOn]}>Final</Text>
                </Pressable>
              </View>

              {/* Template select */}
              <View style={st.sectionHeader}>
                <Text style={st.label}>Predložak</Text>
                <Pressable style={st.smallBtn} onPress={() => setTemplatePickerOpen(true)}>
                  <Text style={st.smallBtnText}>Odaberi</Text>
                </Pressable>
              </View>

              {selectedTemplate ? (
                <View
                  style={[
                    st.pickRow,
                    { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.35)" },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={st.pickTitle}>{(selectedTemplate as any).name}</Text>
                    <Text style={st.pickSub}>
                      #{(selectedTemplate as any).id} • dokumenata:{" "}
                      {(selectedTemplate as any).documents?.length ?? 0}
                    </Text>
                  </View>

                  <Pressable style={[st.iconBtn, { width: 40, height: 40 }]} onPress={resetEditorState}>
                    <FontAwesome name="trash" size={16} color={Colors.text} />
                  </Pressable>
                </View>
              ) : (
                <Text style={st.helper}>Nije odabran predložak.</Text>
              )}

              {/* Standalone items */}
              <View style={st.sectionHeader}>
                <Text style={st.label}>Dodatne stavke</Text>
                <Pressable style={st.smallBtn} onPress={openStandaloneItems}>
                  <Text style={st.smallBtnText}>Dodaj stavke</Text>
                </Pressable>
              </View>

              {/* Docs */}
              {selectedTemplate ? (
                <>
                  <Text style={st.label}>Dokumenti</Text>
                  {templateDocs.length === 0 ? (
                    <Text style={st.helper}>Predložak nema dokumenata.</Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {templateDocs.map((d: any) => {
                        const docId = Number(d.documentId ?? d.document_id ?? 0);
                        const p = patchByDocId.get(docId);
                        const added = ((p as any)?.addItems?.length ?? 0) as number;

                        return (
                          <View key={String(docId)} style={st.docCard}>
                            <View style={{ flex: 1 }}>
                              <Text style={st.docTitle}>Dokument #{docId}</Text>
                              <Text style={st.docSub}>Dodano: {added}</Text>
                            </View>

                            <Pressable style={st.smallBtn} onPress={() => openDocItems(docId)}>
                              <Text style={st.smallBtnText}>Dodaj stavke</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              <Pressable
                style={[st.primaryBtn, (!selectedTemplate || upsertM.isPending) && { opacity: 0.5 }]}
                disabled={!selectedTemplate || upsertM.isPending}
                onPress={save}
              >
                {upsertM.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={st.primaryText}>Spremi</Text>
                )}
              </Pressable>

              <Pressable
                style={[st.ghostBtn, upsertM.isPending && { opacity: 0.6 }]}
                disabled={upsertM.isPending}
                onPress={() => {
                  if (upsertM.isPending) return;
                  setEditOpen(false);
                  setEntry(null);
                }}
              >
                <Text style={st.ghostText}>Zatvori</Text>
              </Pressable>
            </View>
          )}
        </CenterModal>

        {/* Template picker sheet */}
        <SearchPickerSheet<TemplateResponseDTO>
          visible={templatePickerOpen}
          title="Odaberi predložak"
          onClose={() => setTemplatePickerOpen(false)}
          keyOf={(t) => String((t as any).id)}
          fetchPage={async ({ page, size, q }) => {
            const list = await dispatchTemplateService.listTemplates({
              folderId: null,
              name: q ?? "",
              includeShared: true,
              rootOnly: true,
            });

            const items = (list ?? []) as any[];
            return {
              items: items as any,
              page: page ?? 0,
              size: size ?? items.length,
              total: items.length,
            };
          }}
          renderRow={(t, close) => (
            <Pressable
              style={st.pickRow}
              onPress={() => {
                close();
                setTemplatePickerOpen(false);

                // ✅ ključni fix: dohvat full template u idućem ticku (nakon zatvaranja modala)
                setTimeout(async () => {
                  const id = Number((t as any).id ?? 0);
                  if (!id) return;

                  try {
                    const full = await dispatchTemplateService.getTemplate(id);
                    setSelectedTemplate(full as any);
                  } catch {
                    setSelectedTemplate(t as any);
                  }

                  setDocPatches([]);
                  setStandaloneDocId(null);
                  setStandaloneQty({});
                }, 0);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={st.pickTitle}>{(t as any).name ?? `Predložak #${(t as any).id}`}</Text>
                <Text style={st.pickSub}>#{(t as any).id}</Text>
              </View>
            </Pressable>
          )}
          searchPlaceholder="Pretraži predloške…"
          closeOnBackdropPress={false}
        />

        {/* Items modal */}
        <CenterModal visible={itemsOpen} title="Stavke" onClose={() => setItemsOpen(false)}>
          <View style={{ width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 12 }}>
            <View style={st.tabs}>
              <Pressable
                style={[st.tabBtn, itemsTab === "results" && st.tabBtnActive]}
                onPress={() => setItemsTab("results")}
              >
                <Text style={[st.tabText, itemsTab === "results" && st.tabTextActive]}>Rezultati</Text>
              </Pressable>
              <Pressable
                style={[st.tabBtn, itemsTab === "added" && st.tabBtnActive]}
                onPress={() => setItemsTab("added")}
              >
                <Text style={[st.tabText, itemsTab === "added" && st.tabTextActive]}>
                  Dodano ({qtyToItems(qtyDraft).length})
                </Text>
              </Pressable>
            </View>

            {itemsTab === "results" ? (
              <>
                <TextInput
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder="Pretraži artikle…"
                  placeholderTextColor={Colors.sub}
                  style={st.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                {itemsLoading ? (
                  <View style={{ paddingVertical: 12, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : itemsRows.length === 0 ? (
                  <Text style={st.helper}>Nema rezultata.</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {itemsRows.map((it: any) => {
                      const itemId = Number(it.itemId ?? it.id ?? it.item_id ?? 0);
                      if (!itemId) return null;

                      const name = String(it.name ?? it.itemName ?? it.naziv ?? "").trim();
                      const code = String(it.code ?? it.itemCode ?? it.sifra ?? "").trim();
                      const unit = String(it.unit ?? it.jmj ?? "").trim();

                      return (
                        <Pressable
                          key={String(itemId)}
                          style={st.resultRow}
                          onPress={() => {
                            setQtyDraft((cur) => upsertQty(cur, itemId, 1));
                            setItemsTab("added");
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={st.itemNameStrong} numberOfLines={2}>
                              {name ? name : `Artikl #${itemId}`}
                            </Text>
                            <Text style={st.itemMeta}>
                              {[code ? `Šifra: ${code}` : null, `ID: ${itemId}`, unit ? `JMJ: ${unit}` : null]
                                .filter(Boolean)
                                .join(" • ")}
                            </Text>
                          </View>

                          <View style={st.addBtn}>
                            <Text style={st.addBtnText}>+1</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={st.pager}>
                  <Pressable
                    style={[st.pagerBtn, !canPrev && { opacity: 0.4 }]}
                    disabled={!canPrev}
                    onPress={() => setItemsPage((p) => Math.max(0, p - 1))}
                  >
                    <FontAwesome name="chevron-left" size={14} color={Colors.text} />
                  </Pressable>

                  <Text style={st.pagerText}>
                    Str. {itemsPage + 1} / {itemsTotalPages}
                  </Text>

                  <Pressable
                    style={[st.pagerBtn, !canNext && { opacity: 0.4 }]}
                    disabled={!canNext}
                    onPress={() => setItemsPage((p) => p + 1)}
                  >
                    <FontAwesome name="chevron-right" size={14} color={Colors.text} />
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {qtyToItems(qtyDraft).length === 0 ? (
                  <Text style={st.helper}>Još nema dodanih stavki.</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {qtyToItems(qtyDraft).map((x) => (
                      <View key={String(x.itemId)} style={st.addedRow}>
                        <Text style={st.itemMeta}>Artikl #{x.itemId}</Text>
                        <View style={st.qtyBox}>
                          <Pressable
                            style={st.qtyBtn}
                            onPress={() => setQtyDraft((cur) => upsertQty(cur, x.itemId, -1))}
                          >
                            <Text style={st.qtyBtnText}>−</Text>
                          </Pressable>
                          <Text style={st.qtyValue}>{x.quantity}</Text>
                          <Pressable
                            style={st.qtyBtn}
                            onPress={() => setQtyDraft((cur) => upsertQty(cur, x.itemId, +1))}
                          >
                            <Text style={st.qtyBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <Pressable style={st.primaryBtn} onPress={applyItems}>
              <Text style={st.primaryText}>Primijeni</Text>
            </Pressable>

            <Pressable style={st.ghostBtn} onPress={() => setItemsOpen(false)}>
              <Text style={st.ghostText}>Zatvori</Text>
            </Pressable>
          </View>
        </CenterModal>

        {/* Confirm delete entry */}
        <CenterConfirmSheet
          visible={deleteEntryOpen}
          title="Obrisati unos?"
          description={deleteLabel}
          confirmText="Obriši"
          danger
          loading={delEntryM.isPending}
          onClose={() => setDeleteEntryOpen(false)}
          onConfirm={deleteEntry}
          closeOnBackdrop={!delEntryM.isPending}
        />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  heroCard: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },

  label: { fontWeight: "900", color: Colors.text },
  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "800" },

  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontWeight: "900", color: Colors.text },

  rowBtns: { flexDirection: "row", gap: 10 },

  primaryPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPillText: { color: "#fff", fontWeight: "900" },

  ghostPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostPillText: { fontWeight: "900", color: Colors.text },

  dangerPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerPillText: { color: Colors.dangerText, fontWeight: "900" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  ghostBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { fontWeight: "900", color: Colors.text },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },

  docCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docTitle: { fontWeight: "900", color: Colors.text },
  docSub: { color: Colors.sub, fontWeight: "800" },

  pickRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "800" },

  searchInput: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  segmentRow: { flexDirection: "row", gap: 10 },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" },
  segText: { fontWeight: "900", color: Colors.sub },
  segTextOn: { color: Colors.text },

  // modal
  modalWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 1,
  },
  modalCard: {
    width: "100%",
    maxWidth: MAX_W,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: "hidden",
    maxHeight: "85%",
    zIndex: 2,
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: { fontWeight: "900", color: Colors.text, fontSize: 16, flex: 1 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { padding: 14, gap: 12, paddingBottom: 20 },

  // items ui
  tabs: { width: "100%", maxWidth: MAX_W, flexDirection: "row", gap: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "rgba(249,115,22,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
  },
  tabText: { fontWeight: "900", color: Colors.sub },
  tabTextActive: { color: Colors.text },

  resultRow: {
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(249,115,22,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontWeight: "900", color: Colors.text },

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 6 },
  pagerBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  pagerText: { fontWeight: "900", color: Colors.sub },

  addedRow: {
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(148,163,184,0.12)",
    borderRadius: 14,
    padding: 6,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  qtyValue: { fontWeight: "900", color: Colors.text, minWidth: 28, textAlign: "center" },
});
