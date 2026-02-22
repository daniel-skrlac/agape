// app/(tabs)/templates/[id]/otpremi.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/constants/Colors";

import { Banner } from "@/components/Banner";
import { Sheet } from "@/components/Sheet";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";

import ValidateImpactModal from "@/components/ValidateImpactModal";

import type {
  DraftMode,
  DispatchRequestValidationDTO,
  ItemDescriptorResponseDTO,
  PartnerResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  TemplateDocResponseDTO,
  TemplateItemResponseDTO,
} from "@/app/models/generated";

import { partnerService } from "@/app/api/services/partnerService";
import { useItemsPage } from "@/app/api/hooks/useItemDirectory";
import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { useDispatchValidate } from "@/app/api/hooks/useDispatchValidate";
import { ApiError } from "@/app/api/apiClient";

// ✅ NEW: used for background prefetch of item names by itemId
// If your service is named differently, adjust this import to your project.
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";
import { toLocalDateString } from "@/app/utils/dateIso";
import { useBookTemplateMany, useBookTemplateOne, useTemplateDetail } from "@/app/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;
const ITEMS_PAGE_SIZE = 10;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

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

function itemsToQty(items: TemplateBookItemDTO[] | null | undefined): QtyMap {
  const m: QtyMap = {};
  (items ?? []).forEach((it: any) => {
    const id = Number(it.itemId);
    const q = Number(it.quantity ?? 0);
    if (!id || q <= 0) return;
    m[String(id)] = (m[String(id)] ?? 0) + q;
  });
  return m;
}

function mapToDocPatch(docId: number, addItems: TemplateBookItemDTO[]): TemplateBookDocPatchDTO {
  return {
    documentId: docId,
    addItems,
    setItems: [],
    removeItemIds: [],
    draftOverride: null as any,
    noteOverride: null as any,
  } as any;
}

function CenterModal(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  disableClose?: boolean;
}) {
  const { visible, title, onClose, children, disableClose } = props;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={disableClose ? undefined : onClose}>
      <View style={s.modalWrap}>
        <Pressable style={s.backdrop} onPress={disableClose ? undefined : onClose} />
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <Pressable
              style={[s.iconBtn, disableClose && { opacity: 0.5 }]}
              onPress={disableClose ? undefined : onClose}
              disabled={disableClose}
            >
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function upsertMetaMap(prev: Map<number, ItemDescriptorResponseDTO>, items: ItemDescriptorResponseDTO[] | null | undefined) {
  const next = new Map(prev);
  (items ?? []).forEach((it) => {
    const id = Number((it as any).itemId);
    if (!id) return;
    next.set(id, it);
  });
  return next;
}

function itemDisplay(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  const m = metaById.get(Number(itemId));
  const name = (m?.name ?? "").trim();
  if (!name) return null;

  const parts = [
    (m as any)?.code ? `Šifra: ${(m as any).code}` : null,
    (m as any)?.unit ? `JMJ: ${(m as any).unit}` : null,
    (m as any)?.barcode ? `BC: ${(m as any).barcode}` : null,
  ].filter(Boolean);

  return { name, meta: parts.join(" • ") };
}

type PartnerNoteMap = Record<string, string>;
function sanitizeNote(v: string) {
  return (v ?? "").toString().replace(/\r\n/g, "\n").trim();
}
function shorten(s: string, max = 40) {
  const x = (s ?? "").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return x.slice(0, max - 1) + "…";
}

/** Show only backend "message" (no JSON dump). */
function getBackendMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as any;
    return (body?.message as string) || e.message || "Request failed";
  }
  if (e instanceof Error) return e.message || "Request failed";
  return "Request failed";
}

/** tiny concurrency helper */
async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Build payload for /api/v1/dispatch/validate
 * New backend DTO requires partnerId now.
 */
function buildValidatePayload(args: {
  warehouseId: number;
  partnerId: number;
  draftMode: DraftMode;
  templateDocs: TemplateDocResponseDTO[];
  docPatches: TemplateBookDocPatchDTO[];
  standaloneItems: TemplateBookItemDTO[];
  note?: string | null;
}): DispatchRequestValidationDTO {
  const { warehouseId, partnerId, draftMode, templateDocs, docPatches, standaloneItems, note } = args;

  const qty: Record<string, number> = {};
  const addQty = (itemId: any, q: any) => {
    const id = Number(itemId);
    const n = Number(q ?? 0);
    if (!id || !Number.isFinite(n) || n === 0) return;
    const k = String(id);
    qty[k] = Number(qty[k] ?? 0) + n;
  };

  (templateDocs ?? []).forEach((d: any) => ((d?.items ?? []) as any[]).forEach((it) => addQty(it?.itemId, it?.quantity)));
  (docPatches ?? []).forEach((p: any) => ((p?.addItems ?? []) as any[]).forEach((it) => addQty(it?.itemId, it?.quantity)));
  (standaloneItems ?? []).forEach((it: any) => addQty(it?.itemId, it?.quantity));

  const items = Object.entries(qty)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => a.itemId - b.itemId);

  return {
    warehouseId: Number(warehouseId),
    partnerId: Number(partnerId),
    documentDate: undefined as any,
    draft: draftMode === "DRAFT",
    note: note ?? undefined,
    items: items as any,
  } as any;
}

export default function Otpremi() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const tplQ = useTemplateDetail(templateId);
  const template = tplQ.data;
  const templateDocs: TemplateDocResponseDTO[] = (template?.documents ?? []) as any;

  const bookOneM = useBookTemplateOne();
  const bookManyM = useBookTemplateMany();
  const validateM = useDispatchValidate();

  const err =
    (tplQ.error as any)?.message ||
    (bookOneM.error as any)?.message ||
    (bookManyM.error as any)?.message ||
    null;

  const refreshing = tplQ.isFetching;
  const onRefresh = () => tplQ.refetch();
  const bookingBusy = bookOneM.isPending || bookManyM.isPending;

  if (ready && !warehouseId) {
    return (
      <Screen>
        <NavigationHeader title="Otpremi" subtitle={`Predložak #${templateId}`} fallbackHref="/(tabs)/templates" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Banner type="error" text="Nema odabranog glavnog skladišta. U Postavkama odaberi glavno skladište." />
        </ScrollView>
      </Screen>
    );
  }

  // ------------------ PARTNERS ------------------
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<PartnerResponseDTO[]>([]);
  const selectedPartnerIds = useMemo(() => new Set(selectedPartners.map((p) => normId(p.id))), [selectedPartners]);

  const togglePartner = (p: PartnerResponseDTO) => {
    const pid = normId(p.id);
    const exists = selectedPartners.some((x) => normId(x.id) === pid);
    setSelectedPartners(exists ? selectedPartners.filter((x) => normId(x.id) !== pid) : [...selectedPartners, p]);
  };

  // per-partner note
  const [noteByPartnerId, setNoteByPartnerId] = useState<PartnerNoteMap>({});
  useEffect(() => {
    const ids = new Set(selectedPartners.map((p) => String(normId(p.id))));
    setNoteByPartnerId((prev) => {
      const next: PartnerNoteMap = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (ids.has(k)) next[k] = v;
      });
      return next;
    });
  }, [selectedPartners]);

  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<PartnerResponseDTO | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const openNoteForPartner = (p: PartnerResponseDTO) => {
    const pid = String(normId(p.id));
    setNoteTarget(p);
    setNoteDraft(noteByPartnerId[pid] ?? "");
    setNoteSheetOpen(true);
  };

  const applyPartnerNote = () => {
    if (!noteTarget) return;
    const pid = String(normId(noteTarget.id));
    const cleaned = sanitizeNote(noteDraft);

    setNoteByPartnerId((prev) => {
      if (!cleaned) {
        const { [pid]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [pid]: cleaned };
    });

    setNoteSheetOpen(false);
    setNoteTarget(null);
    setNoteDraft("");
  };

  const clearPartnerNote = () => setNoteDraft("");

  // ------------------ DRAFT/FINAL ------------------
  const [draftMode, setDraftMode] = useState<DraftMode>("DRAFT");

  // ------------------ DOC PATCHES + STANDALONE ------------------
  const [docPatches, setDocPatches] = useState<TemplateBookDocPatchDTO[]>([]);
  const patchByDocId = useMemo(() => {
    const m = new Map<number, TemplateBookDocPatchDTO>();
    (docPatches ?? []).forEach((p) => m.set(Number(p.documentId), p));
    return m;
  }, [docPatches]);

  const [standaloneItems, setStandaloneItems] = useState<TemplateBookItemDTO[]>([]);

  // ------------------ RESULT SHEET ------------------
  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState("");

  // ------------------ ITEM PICKER ------------------
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsTarget, setItemsTarget] = useState<{ kind: "DOC"; documentId: number } | { kind: "STANDALONE" } | null>(null);
  const [itemsTab, setItemsTab] = useState<"results" | "added">("results");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [itemsPage, setItemsPage] = useState(0);

  useEffect(() => {
    const tt = setTimeout(() => setDebouncedQ(searchQ.trim()), 250);
    return () => clearTimeout(tt);
  }, [searchQ]);

  useEffect(() => setItemsPage(0), [debouncedQ]);

  const itemsQ = useItemsPage({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    page: itemsPage,
    size: ITEMS_PAGE_SIZE,
    q: debouncedQ || undefined,
  });

  const itemsTotal = itemsQ.data?.total ?? 0;
  const itemsTotalPages = Math.max(1, Math.ceil(itemsTotal / ITEMS_PAGE_SIZE));
  const canPrev = itemsPage > 0;
  const canNext = itemsPage + 1 < itemsTotalPages;

  // cache for item names/metadata
  const [metaById, setMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());
  useEffect(() => {
    if (itemsQ.data?.items?.length) setMetaById((prev) => upsertMetaMap(prev, itemsQ.data!.items as any));
  }, [itemsQ.data?.items]);

  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});

  const openStandalone = () => {
    setQtyDraft(itemsToQty(standaloneItems as any));
    setItemsTarget({ kind: "STANDALONE" });
    setItemsOpen(true);

    setItemsTab("results");
    setSearchQ("");
    setDebouncedQ("");
    setItemsPage(0);
  };

  const addOne = (meta: ItemDescriptorResponseDTO) => {
    setMetaById((prev) => upsertMetaMap(prev, [meta]));
    setQtyDraft((cur) => upsertQty(cur, Number((meta as any).itemId), 1));
    setItemsTab("added");
  };

  const bumpQty = (itemId: number, delta: number) => setQtyDraft((cur) => upsertQty(cur, Number(itemId), delta));

  const setQtyFor = (itemId: number, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    setQtyDraft((cur) => ({ ...cur, [String(itemId)]: qty }));
  };

  const removeItem = (itemId: number) => {
    setQtyDraft((cur) => {
      const k = String(itemId);
      const { [k]: _, ...rest } = cur;
      return rest;
    });
  };

  const applyItems = () => {
    if (!itemsTarget) return;
    const items = qtyToItems(qtyDraft);

    if (itemsTarget.kind === "DOC") {
      // (not used in this screen right now)
    } else {
      setStandaloneItems(items as any);
    }

    setItemsOpen(false);
    setItemsTarget(null);
  };

  // ------------------ TEMPLATE ROWS ------------------
  const defaultRowsByDoc = useMemo(() => {
    return (templateDocs ?? [])
      .map((d) => {
        const docId = Number((d as any)?.documentId);
        const rows = (((d as any)?.items ?? []) as TemplateItemResponseDTO[])
          .map((x) => ({
            itemId: Number((x as any).itemId),
            quantity: Number((x as any).quantity ?? 0),
          }))
          .filter((x) => x.itemId && x.quantity > 0)
          .sort((a, b) => a.itemId - b.itemId);
        return { docId, rows, count: rows.length };
      })
      .filter((x) => x.docId);
  }, [templateDocs]);

  // ✅ NEW: collect all itemIds we need names for
  const neededItemIds = useMemo(() => {
    const ids = new Set<number>();

    // defaults from template
    (templateDocs ?? []).forEach((d: any) => ((d?.items ?? []) as any[]).forEach((it) => ids.add(Number(it?.itemId))));

    // patches
    (docPatches ?? []).forEach((p: any) => ((p?.addItems ?? []) as any[]).forEach((it) => ids.add(Number(it?.itemId))));

    // standalone
    (standaloneItems ?? []).forEach((it: any) => ids.add(Number(it?.itemId)));

    return Array.from(ids).filter((x) => Number(x) > 0);
  }, [templateDocs, docPatches, standaloneItems]);

  // ✅ NEW: background prefetch names for missing itemIds (no placeholders in UI)
  const [metaLoading, setMetaLoading] = useState(false);
  const metaRunRef = useRef(0);

  useEffect(() => {
    if (!warehouseId) return;
    if (!neededItemIds.length) return;

    const missing = neededItemIds.filter((id) => {
      const m = metaById.get(Number(id));
      return !m || !String((m as any)?.name ?? "").trim();
    });

    if (!missing.length) return;

    let cancelled = false;
    const runId = ++metaRunRef.current;

    (async () => {
      setMetaLoading(true);
      try {
        const results = await mapConcurrent(missing, 3, async (id) => {
          try {
            // Assumes the directory search accepts q="123" (id) and returns that item in results.
            const res: any = await itemDirectoryService.pageItems({
              warehouseId: Number(warehouseId),
              page: 0,
              size: 10,
              q: String(id),
            });

            const hit = (res.items ?? []).find((x: any) => Number(x?.itemId) === Number(id)) ?? null;
            return hit as ItemDescriptorResponseDTO | null;
          } catch {
            return null;
          }
        });

        if (cancelled) return;
        if (metaRunRef.current !== runId) return;

        const found = results.filter(Boolean) as ItemDescriptorResponseDTO[];
        if (found.length) setMetaById((prev) => upsertMetaMap(prev, found));
      } finally {
        if (cancelled) return;
        if (metaRunRef.current !== runId) return;
        setMetaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, neededItemIds.join(","), metaById]);

  // ------------------ VALIDATE MODAL ------------------
  const [validateOpen, setValidateOpen] = useState(false);

  const validateLoading = validateM.isPending;
  const validateData = validateM.data ?? null;
  const validateError = validateM.error ? getBackendMessage(validateM.error) : null;

  const openValidate = async () => {
    if (!warehouseId) {
      setResultText("Nema skladišta.");
      setResultOpen(true);
      return;
    }
    if (selectedPartners.length === 0) {
      setResultText("Odaberi barem jednog partnera.");
      setResultOpen(true);
      return;
    }
    if (!templateDocs || templateDocs.length === 0) {
      setResultText("Predložak nema dokumenata.");
      setResultOpen(true);
      return;
    }

    // backend DTO requires partnerId, so validate can only run for one partner
    if (selectedPartners.length !== 1) {
      setResultText("Validacija trenutno radi samo za 1 partnera (backend traži partnerId). Odaberi točno jednog partnera.");
      setResultOpen(true);
      return;
    }

    const p = selectedPartners[0];
    const note = noteByPartnerId[String(normId(p.id))] ?? null;

    const payload = buildValidatePayload({
      warehouseId: Number(warehouseId),
      partnerId: Number(p.id),
      draftMode,
      templateDocs,
      docPatches,
      standaloneItems,
      note,
    });

    if (!payload.items || (payload.items as any[]).length === 0) {
      setResultText("Nema stavki za validaciju.");
      setResultOpen(true);
      return;
    }

    setValidateOpen(true);
    validateM.reset();

    try {
      await validateM.mutateAsync(payload as any);
    } catch {
      // shown in modal as validateError
    }
  };

  // ------------------ BOOKING ------------------
  const doSubmitBooking = async () => {
    if (!warehouseId) return;
    if (selectedPartners.length === 0) return;

    if (!templateDocs || templateDocs.length === 0) {
      setResultText("Predložak nema dokumenata.");
      setResultOpen(true);
      return;
    }

    const documentDate = toLocalDateString(new Date());

    if (selectedPartners.length === 1) {
      const p = selectedPartners[0];
      const note = noteByPartnerId[String(normId(p.id))] ?? null;

      const res = await bookOneM.mutateAsync({
        templateId,
        warehouseId,
        partnerId: p.id,
        documentDate: documentDate as any,
        draftMode: draftMode as any,
        docPatches: docPatches as any,
        extraItems: standaloneItems as any,
        extraDocuments: [] as any,
        note: note as any,
      } as any);

      setResultText(`Uspjeh: ${res.succeeded}/${res.total} • Neuspjeh: ${res.failed}`);
      setResultOpen(true);
      return;
    }

    const total = selectedPartners.length;
    let ok = 0;
    let fail = 0;

    for (const p of selectedPartners) {
      const note = noteByPartnerId[String(normId(p.id))] ?? null;

      try {
        const r = await bookOneM.mutateAsync({
          templateId,
          warehouseId,
          partnerId: p.id,
          documentDate: documentDate as any,
          draftMode: draftMode as any,
          docPatches: docPatches as any,
          extraItems: standaloneItems as any,
          extraDocuments: [] as any,
          note: note as any,
        } as any);

        if ((r as any)?.succeeded > 0) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }

    setResultText(`Uspjeh: ${ok}/${total} • Neuspjeh: ${fail}`);
    setResultOpen(true);
  };

  const confirmValidateAndSubmit = async () => {
    setValidateOpen(false);
    await doSubmitBooking();
  };

  // ✅ helper: doc is ready only if ALL its items have names
  const isDocReady = (docId: number, rows: { itemId: number; quantity: number }[]) => {
    const baseOk = (rows ?? []).every((r) => !!itemDisplay(Number(r.itemId), metaById));
    const patch = patchByDocId.get(Number(docId));
    const added = (((patch as any)?.addItems ?? []) as any[]).map((x) => Number(x.itemId)).filter(Boolean);
    const patchOk = added.every((id) => !!itemDisplay(id, metaById));
    return baseOk && patchOk;
  };

  // ------------------ RENDER ------------------
  return (
    <Screen>
      <NavigationHeader title="Otpremi" subtitle={`Predložak #${templateId}`} fallbackHref="/(tabs)/templates" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!!err && <Banner type="error" text={err} />}

        <Text style={s.label}>Posting mode</Text>
        <Segmented<DraftMode>
          value={draftMode}
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "FINAL", label: "Final" },
          ]}
          onChange={setDraftMode}
        />

        <Pressable style={s.primary} onPress={() => setPartnerPickerOpen(true)}>
          <Text style={s.primaryText}>{selectedPartners.length === 0 ? "Odaberi partnere" : `Odabrano: ${selectedPartners.length}`}</Text>
        </Pressable>

        <Text style={s.label}>Stavke po dokumentu (default iz predloška)</Text>

        {tplQ.isLoading ? (
          <Text style={s.helper}>Učitavam predložak…</Text>
        ) : defaultRowsByDoc.length === 0 ? (
          <Text style={s.helper}>Nema dokumenata / stavki u predlošku.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {defaultRowsByDoc.map((block) => {
              const readyDoc = isDocReady(block.docId, block.rows);

              return (
                <View key={String(block.docId)} style={s.cardCol}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>Dokument #{block.docId}</Text>
                      <Text style={s.sub}>Default stavki: {block.count}</Text>
                    </View>
                  </View>

                  {/* ✅ NO placeholders: show nothing until names are fetched */}
                  {!readyDoc ? (
                    <View style={{ paddingVertical: 10, alignItems: "center", gap: 8 }}>
                      <ActivityIndicator />
                    </View>
                  ) : block.count === 0 ? (
                    <Text style={s.muted}>Nema stavki.</Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {block.rows.map((r) => {
                        const disp = itemDisplay(Number(r.itemId), metaById);
                        if (!disp) return null;

                        return (
                          <View key={String(r.itemId)} style={s.simpleRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.itemNameStrong} numberOfLines={2}>
                                {disp.name}
                              </Text>
                              {!!disp.meta && (
                                <Text style={s.itemMeta} numberOfLines={1}>
                                  {disp.meta}
                                </Text>
                              )}
                            </View>
                            <Text style={s.simpleRight}>x{r.quantity}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Patch items (if any) - also only when readyDoc=true */}
                  {readyDoc &&
                    (() => {
                      const patch = patchByDocId.get(Number(block.docId));
                      const added = ((patch as any)?.addItems ?? []) as any[];
                      if (!added.length) return null;

                      return (
                        <View style={{ gap: 8, marginTop: 10 }}>
                          <Text style={s.blockTitle}>Dodano na ovaj dokument</Text>
                          {added
                            .slice()
                            .sort((a, b) => Number(a.itemId) - Number(b.itemId))
                            .map((x) => {
                              const disp = itemDisplay(Number(x.itemId), metaById);
                              if (!disp) return null;

                              return (
                                <View key={`patch-${block.docId}-${x.itemId}`} style={s.simpleRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.itemNameStrong} numberOfLines={2}>
                                      {disp.name}
                                    </Text>
                                    {!!disp.meta && (
                                      <Text style={s.itemMeta} numberOfLines={1}>
                                        {disp.meta}
                                      </Text>
                                    )}
                                  </View>
                                  <Text style={s.simpleRight}>+x{Number(x.quantity ?? 0)}</Text>
                                </View>
                              );
                            })}
                        </View>
                      );
                    })()}
                </View>
              );
            })}
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.label}>Dodane stavke van dokumenta</Text>
          <Pressable style={s.secondaryBtn} onPress={openStandalone}>
            <Text style={s.secondaryText}>{standaloneItems.length ? `Uredi (${standaloneItems.length})` : "+ Dodaj"}</Text>
          </Pressable>
        </View>

        <View style={s.cardCol}>
          <Text style={s.title}>Dodano van dokumenta</Text>
          <Text style={s.sub}>Stavki: {standaloneItems.length}</Text>

          {standaloneItems.length === 0 ? (
            <Text style={s.muted}>Nema dodanih stavki.</Text>
          ) : (() => {
              const readyStandalone = standaloneItems.every((it) => !!itemDisplay(Number((it as any).itemId), metaById));
              if (!readyStandalone) {
                return (
                  <View style={{ paddingVertical: 10, alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={s.muted}>Učitavam nazive stavki…</Text>
                  </View>
                );
              }

              return (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {standaloneItems
                    .slice()
                    .sort((a, b) => Number(a.itemId) - Number(b.itemId))
                    .map((r) => {
                      const disp = itemDisplay(Number(r.itemId), metaById);
                      if (!disp) return null;

                      return (
                        <View key={String(r.itemId)} style={s.simpleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNameStrong} numberOfLines={2}>
                              {disp.name}
                            </Text>
                            {!!disp.meta && (
                              <Text style={s.itemMeta} numberOfLines={1}>
                                {disp.meta}
                              </Text>
                            )}
                          </View>
                          <Text style={s.simpleRight}>x{Number(r.quantity ?? 0)}</Text>
                        </View>
                      );
                    })}
                </View>
              );
            })()}

          <Text style={[s.helper, { marginTop: 8 }]}>
            Ove stavke nisu vezane uz određeni dokument. Aplikacija će ih primijeniti na prvi dokument predloška.
          </Text>
        </View>

        <Pressable
          style={[s.primary, (selectedPartners.length === 0 || !warehouseId || bookingBusy || validateLoading) && { opacity: 0.5 }]}
          disabled={selectedPartners.length === 0 || !warehouseId || bookingBusy || validateLoading}
          onPress={openValidate}
        >
          <Text style={s.primaryText}>{bookingBusy || validateLoading ? "Radim…" : "Validiraj i kreiraj"}</Text>
        </Pressable>

        <Text style={s.label}>Odabrani partneri (note po partneru)</Text>

        <FlatList
          data={selectedPartners}
          keyExtractor={(x) => String(x.id)}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const pid = String(normId(item.id));
            const note = noteByPartnerId[pid] ?? "";
            const hasNote = !!note.trim();

            return (
              <View style={s.cardSelected}>
                <View style={s.checkDotSelected}>
                  <Text style={s.checkDotTextSelected}>✓</Text>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.title}>{item.name}</Text>
                  <Text style={s.sub}>
                    #{item.partnerNumber} • {item.city}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Pressable style={s.noteBtn} onPress={() => openNoteForPartner(item)}>
                      <FontAwesome name="sticky-note" size={14} color={Colors.text} />
                      <Text style={s.noteBtnText}>{hasNote ? "Uredi note" : "Dodaj note"}</Text>
                    </Pressable>

                    {hasNote && (
                      <View style={s.notePill}>
                        <Text style={s.notePillText}>{shorten(note, 46)}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Pressable style={s.remove} onPress={() => togglePartner(item)}>
                  <Text style={s.removeText}>Obriši</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>Nema odabranih partnera.</Text>}
        />

        <SearchPickerSheet<PartnerResponseDTO>
          visible={partnerPickerOpen}
          title="Odaberi partnere"
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
                    <Text style={s.pillText}>Odabrano</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />

        {/* Items modal */}
        <CenterModal
          visible={itemsOpen}
          title={itemsTarget?.kind === "DOC" ? `Dodaj stavke • Dokument #${itemsTarget.documentId}` : "Dodaj stavke van dokumenta"}
          disableClose={bookingBusy}
          onClose={() => {
            if (bookingBusy) return;
            setItemsOpen(false);
            setItemsTarget(null);
          }}
        >
          {!warehouseId ? (
            <Text style={s.helper}>Nema defaultWarehouseId.</Text>
          ) : (
            <View style={s.centerBlock}>
              <View style={s.tabs}>
                <Pressable style={[s.tabBtn, itemsTab === "results" && s.tabBtnActive]} onPress={() => setItemsTab("results")}>
                  <Text style={[s.tabText, itemsTab === "results" && s.tabTextActive]}>Rezultati</Text>
                </Pressable>
                <Pressable style={[s.tabBtn, itemsTab === "added" && s.tabBtnActive]} onPress={() => setItemsTab("added")}>
                  <Text style={[s.tabText, itemsTab === "added" && s.tabTextActive]}>Dodano ({qtyToItems(qtyDraft).length})</Text>
                </Pressable>
              </View>

              {itemsTab === "results" ? (
                <>
                  <TextInput
                    value={searchQ}
                    onChangeText={setSearchQ}
                    placeholder="Pretraži artikle (naziv, šifra)…"
                    placeholderTextColor={PLACEHOLDER}
                    style={s.input}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />

                  {!!itemsQ.error && <Banner type="error" text={(itemsQ.error as any)?.message ?? "Greška pri dohvaćanju artikala."} />}

                  <View style={s.block}>
                    <Text style={s.blockTitle}>Rezultati</Text>

                    {itemsQ.isLoading ? (
                      <View style={{ paddingVertical: 12, alignItems: "center" }}>
                        <ActivityIndicator />
                      </View>
                    ) : (itemsQ.data?.items?.length ?? 0) === 0 ? (
                      <Text style={s.muted}>Nema rezultata.</Text>
                    ) : (
                      <View style={{ gap: 10, alignSelf: "stretch" }}>
                        {(itemsQ.data?.items ?? []).map((it) => (
                          <View key={String((it as any).itemId)} style={s.resultRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.itemNameStrong} numberOfLines={2}>
                                {(it as any).name}
                              </Text>
                              {!![(it as any).code, (it as any).unit].filter(Boolean).length && (
                                <Text style={s.itemMeta} numberOfLines={1}>
                                  {[(it as any).code ? `Šifra: ${(it as any).code}` : null, (it as any).unit ? `JMJ: ${(it as any).unit}` : null]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </Text>
                              )}
                            </View>

                            <Pressable style={s.addBtn} onPress={() => addOne(it as any)}>
                              <Text style={s.addBtnText}>+1</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={s.pager}>
                      <Pressable style={[s.pagerBtn, !canPrev && { opacity: 0.4 }]} disabled={!canPrev} onPress={() => setItemsPage((p) => Math.max(0, p - 1))}>
                        <FontAwesome name="chevron-left" size={14} color={Colors.text} />
                      </Pressable>

                      <Text style={s.pagerText}>
                        Str. {itemsPage + 1} / {itemsTotalPages}
                      </Text>

                      <Pressable style={[s.pagerBtn, !canNext && { opacity: 0.4 }]} disabled={!canNext} onPress={() => setItemsPage((p) => p + 1)}>
                        <FontAwesome name="chevron-right" size={14} color={Colors.text} />
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <View style={s.block}>
                  <Text style={s.blockTitle}>Dodane stavke</Text>

                  {qtyToItems(qtyDraft).length === 0 ? (
                    <Text style={s.muted}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>
                  ) : (
                    <View style={{ gap: 10, alignSelf: "stretch" }}>
                      {qtyToItems(qtyDraft)
                        .slice()
                        .sort((a, b) => Number(a.itemId) - Number(b.itemId))
                        .map((x) => {
                          const disp = itemDisplay(Number(x.itemId), metaById);
                          // ✅ in picker "added" tab, we still show the row even if meta missing (rare)
                          const name = disp?.name ?? String((metaById.get(Number(x.itemId)) as any)?.name ?? "").trim();
                          const meta = disp?.meta ?? "";

                          return (
                            <View key={String(x.itemId)} style={s.itemRow}>
                              <View style={{ flex: 1 }}>
                                {!!name ? (
                                  <>
                                    <Text style={s.itemNameStrong} numberOfLines={2}>
                                      {name}
                                    </Text>
                                    {!!meta && (
                                      <Text style={s.itemMeta} numberOfLines={1}>
                                        {meta}
                                      </Text>
                                    )}
                                  </>
                                ) : (
                                  <View style={{ paddingVertical: 6 }}>
                                    <ActivityIndicator />
                                  </View>
                                )}
                              </View>

                              <View style={s.qtyBox}>
                                <Pressable style={s.qtyBtn} onPress={() => bumpQty(x.itemId, -1)}>
                                  <Text style={s.qtyBtnText}>−</Text>
                                </Pressable>

                                <TextInput
                                  value={String(x.quantity)}
                                  onChangeText={(v) => {
                                    const n = Number(String(v).replace(",", "."));
                                    if (!Number.isFinite(n)) return;
                                    setQtyFor(x.itemId, n);
                                  }}
                                  keyboardType="numeric"
                                  placeholder="1"
                                  placeholderTextColor={PLACEHOLDER}
                                  style={s.qtyInput}
                                />

                                <Pressable style={s.qtyBtn} onPress={() => bumpQty(x.itemId, +1)}>
                                  <Text style={s.qtyBtnText}>+</Text>
                                </Pressable>
                              </View>

                              <Pressable style={s.smallDangerBtn} onPress={() => removeItem(x.itemId)}>
                                <Text style={s.smallDangerText}>X</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>
              )}

              <Pressable style={s.primary} onPress={applyItems}>
                <Text style={s.primaryText}>Primijeni</Text>
              </Pressable>

              <Pressable
                style={s.btnWide}
                onPress={() => {
                  setItemsOpen(false);
                  setItemsTarget(null);
                }}
              >
                <Text style={s.btnText}>Zatvori</Text>
              </Pressable>
            </View>
          )}
        </CenterModal>

        <CenterSheet
          visible={noteSheetOpen}
          title="Note za partnera"
          onClose={() => {
            if (bookingBusy) return;
            setNoteSheetOpen(false);
            setNoteTarget(null);
          }}
          closeOnBackdrop={false}
          disableClose={bookingBusy}
          width={MAX_W}
        >
          {!!noteTarget && (
            <Text style={{ fontWeight: "800", color: Colors.sub, marginBottom: 10 }}>
              {noteTarget.name} • #{noteTarget.partnerNumber}
            </Text>
          )}

          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="Upiši note (npr. 'Dostaviti do 12h', 'Nazvati prije dostave'...)"
            placeholderTextColor={PLACEHOLDER}
            style={s.noteInput}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
          />

          <View style={{ gap: 12 }}>
            <Pressable style={s.primary} onPress={applyPartnerNote} disabled={bookingBusy}>
              <Text style={s.primaryText}>Spremi note</Text>
            </Pressable>

            <Pressable
              style={s.btnWide}
              onPress={() => {
                if (bookingBusy) return;
                setNoteSheetOpen(false);
                setNoteTarget(null);
              }}
              disabled={bookingBusy}
            >
              <Text style={s.btnText}>Zatvori</Text>
            </Pressable>

            <Pressable style={s.secondaryBtn} onPress={clearPartnerNote} disabled={bookingBusy}>
              <Text style={s.secondaryText}>Obriši unos</Text>
            </Pressable>
          </View>
        </CenterSheet>

        <Sheet visible={resultOpen} title="Rezultat" onClose={() => setResultOpen(false)}>
          <Text style={{ fontWeight: "900", color: Colors.text }}>{resultText}</Text>
          <Pressable style={s.primary} onPress={() => setResultOpen(false)}>
            <Text style={s.primaryText}>OK</Text>
          </Pressable>
        </Sheet>
      </ScrollView>

      <ValidateImpactModal
        visible={validateOpen}
        onClose={() => {
          if (bookingBusy || validateLoading) return;
          setValidateOpen(false);
        }}
        disableClose={bookingBusy || validateLoading}
        loading={validateLoading}
        error={validateError}
        data={validateData}
        onConfirm={confirmValidateAndSubmit}
        confirmText="Kreiraj"
      />
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
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  cardCol: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },

  title: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  sub: { color: Colors.sub, fontWeight: "800" },
  muted: { color: Colors.sub, fontWeight: "700" },

  blockTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  simpleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
    alignItems: "center",
  },
  simpleRight: { fontWeight: "900", color: Colors.sub },

  cardSelected: {
    backgroundColor: "rgba(249,115,22,0.10)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.orange,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  remove: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.dangerBg },
  removeText: { fontWeight: "900", color: Colors.dangerText },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 12 },

  noteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
  },
  noteBtnText: { fontWeight: "900", color: Colors.text },

  notePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.25)",
  },
  notePillText: { fontWeight: "900", color: Colors.text },

  checkDotSelected: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkDotTextSelected: { fontWeight: "900", color: "#fff" },

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
  checkDotText: { fontWeight: "900", color: Colors.text },

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

  modalWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalCard: {
    width: "100%",
    maxWidth: MAX_W,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: "hidden",
    maxHeight: "85%",
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

  centerBlock: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 12, alignItems: "center" },

  noteInput: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    minHeight: 120,
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  input: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  block: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 10 },
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

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  pagerBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  pagerText: { fontWeight: "900", color: Colors.sub },

  itemRow: {
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  qtyInput: { width: 58, textAlign: "center", fontWeight: "900", color: Colors.text, paddingVertical: 6 },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallDangerText: { fontWeight: "900", color: Colors.dangerText },

  btnWide: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "900", color: Colors.text },

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
});
