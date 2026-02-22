// app/(tabs)/sessions/[id]/entry.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import NavigationHeader from "@/components/NavigationHeader";
import { CenterSheet } from "@/components/CenterSheet";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  ItemDescriptorResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  TemplateDocResponseDTO,
  TemplateResponseDTO,
} from "@/app/models/generated";

import { dispatchTemplateService } from "@/app/api/services/dispatchTemplateService";
import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession, useUpsertBookingSessionEntry } from "@/app/api/hooks/useBookingSessions";
import { useItemsPage } from "@/app/api/hooks/useItemDirectory";

import { QtyMap, useEntryDraft, getDraft, setDraft, clearDraft, patchDraft, ensureDraft } from "../_entryDraftStore";

const MAX_W = 560;
const ITEMS_PAGE_SIZE = 10;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) return s.slice(1, -1);
  return s;
}

// robust number parse (handles "1,395" etc.)
function num(v: any): number {
  if (v == null) return 0;
  const s = String(v).replace(/[\s,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isBlankNote(v: any): boolean {
  if (v == null) return true;
  if (Array.isArray(v) && v.length === 0) return true; // backend bug: note=[]
  const s = cleanText(v);
  if (!s) return true;
  if (s.replace(/\s/g, "") === "[]") return true; // backend bug: note="[]"
  return false;
}

function sanitizeNote(v: string) {
  return (v ?? "").toString().replace(/\r\n/g, "\n").trim();
}
function shorten(s: string, max = 90) {
  const x = (s ?? "").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return x.slice(0, max - 1) + "…";
}
function countLines(s: string) {
  const x = (s ?? "").trim();
  if (!x) return 0;
  return x.split("\n").length;
}
function firstLine(s: string) {
  const x = (s ?? "").trim();
  if (!x) return "";
  return x.split("\n")[0] ?? "";
}

function safeJsonArray(v: any): any[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  const s = String(v).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonAny(v: any): any {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// hydrate qty-map from extraItems so extra items persist after reload
function itemsToQtyMap(items: any): QtyMap {
  const arr = safeJsonArray(items);
  const out: QtyMap = {};
  for (const it of arr) {
    const id = num(it?.itemId ?? it?.item_id ?? it?.id ?? it?.item?.id ?? 0);
    const q = Number(it?.quantity ?? it?.qty ?? 0);
    if (!id || q <= 0) continue;
    out[String(id)] = (out[String(id)] ?? 0) + q;
  }
  return out;
}

// ---- Robust ID normalizers ----
function normDocDocumentId(d: any): number {
  return num(d?.documentId ?? d?.document_id ?? d?.document?.id ?? d?.document?.documentId ?? 0);
}
function normTemplateDocId(d: any): number {
  return num(d?.id ?? d?.templateDocId ?? d?.template_doc_id ?? 0);
}
function normItemId(x: any): number {
  return num(x?.itemId ?? x?.item_id ?? x?.id ?? x?.item?.id ?? 0);
}

function upsertMetaMap(prev: Map<number, ItemDescriptorResponseDTO>, items: any[] | null | undefined) {
  const next = new Map(prev);
  (items ?? []).forEach((it: any) => {
    const id = normItemId(it);
    if (!id) return;
    next.set(id, it);
  });
  return next;
}

function itemName(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  return metaById.get(Number(itemId))?.name?.trim() ?? `Item #${Number(itemId)}`;
}
function itemMeta(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  const m: any = metaById.get(Number(itemId));
  if (!m) return "";
  const parts = [m.code ? `Šifra: ${m.code}` : null, m.unit ? `JMJ: ${m.unit}` : null, m.barcode ? `BC: ${m.barcode}` : null].filter(Boolean);
  return parts.join(" • ");
}

function qtyToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty ?? {})
    .map(([k, v]) => ({ itemId: num(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => Number(a.itemId) - Number(b.itemId));
}

function normTemplateDocItems(d: any): Array<{ itemId: number; quantity: number; sortOrder?: number }> {
  const raw = (d?.items ?? d?.docItems ?? d?.documentItems ?? d?.lines ?? []) as any[];
  return (raw ?? [])
    .map((x: any) => ({
      itemId: normItemId(x),
      quantity: Number(x?.quantity ?? x?.qty ?? 0),
      sortOrder: num(x?.sortOrder ?? x?.sort_order ?? 0) || undefined,
    }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => (Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)) || (a.itemId - b.itemId));
}

/**
 * Accept docPatches in MANY shapes and normalize to backend DTO:
 *   TemplateBookDocPatchDTO { documentId: Long, addItems: List<TemplateBookItemDTO> }
 *
 * Supported raw shapes:
 *  - Array<patch>
 *  - JSON string of array
 *  - Single patch object
 *  - Record<docId, QtyMap | items[] | {addItems/items/lines: ...}>
 *  - Nested document: { document: { id } }
 */
function normalizeDocPatches(raw: any): TemplateBookDocPatchDTO[] {
  if (raw == null) return [];

  let arr: any[] = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    const parsed = safeJsonAny(raw);
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && typeof parsed === "object") arr = [parsed];
    else arr = [];
  } else if (typeof raw === "object") {
    const maybeDocId =
      num((raw as any)?.documentId ?? (raw as any)?.document_id ?? (raw as any)?.docId ?? (raw as any)?.doc_id ?? (raw as any)?.document?.id ?? 0);
    if (maybeDocId) {
      arr = [raw];
    } else {
      arr = Object.entries(raw as any).map(([k, v]) => ({ documentId: num(k), addItems: v }));
    }
  }

  if (!arr.length) return [];

  const docMap = new Map<number, Map<number, number>>(); // docId -> itemId -> qty

  for (const p of arr) {
    const documentId = num(p?.documentId ?? p?.document_id ?? p?.docId ?? p?.doc_id ?? p?.document?.id ?? 0);
    if (!documentId) continue;

    let addItemsRaw = p?.addItems ?? p?.add_items ?? p?.items ?? p?.lines ?? [];

    // allow nested json string
    if (typeof addItemsRaw === "string") addItemsRaw = safeJsonAny(addItemsRaw) ?? [];

    // map/object => could be wrapper object or QtyMap
    if (addItemsRaw && typeof addItemsRaw === "object" && !Array.isArray(addItemsRaw)) {
      const w: any = addItemsRaw;
      if (w.addItems || w.items || w.lines) {
        addItemsRaw = w.addItems ?? w.items ?? w.lines ?? [];
      } else {
        // treat as QtyMap
        const tmp: any[] = [];
        for (const [ik, iv] of Object.entries(w)) {
          const itemId = num(ik);
          const quantity = Number(iv ?? 0);
          if (itemId && quantity > 0) tmp.push({ itemId, quantity });
        }
        addItemsRaw = tmp;
      }
    }

    const itemsArr = Array.isArray(addItemsRaw) ? addItemsRaw : safeJsonArray(addItemsRaw);

    for (const it of itemsArr) {
      const itemId = num(it?.itemId ?? it?.item_id ?? it?.id ?? it?.item?.id ?? 0);
      const quantity = Number(it?.quantity ?? it?.qty ?? 0);
      if (!itemId || quantity <= 0) continue;

      if (!docMap.has(documentId)) docMap.set(documentId, new Map());
      const itemMap = docMap.get(documentId)!;
      itemMap.set(itemId, (itemMap.get(itemId) ?? 0) + quantity);
    }
  }

  const out: any[] = [];
  for (const [documentId, itemMap] of docMap.entries()) {
    const addItems = Array.from(itemMap.entries())
      .map(([itemId, quantity]) => ({ itemId, quantity }))
      .filter((x) => x.itemId && x.quantity > 0)
      .sort((a, b) => a.itemId - b.itemId);

    out.push({ documentId, addItems });
  }

  out.sort((a, b) => Number(a.documentId) - Number(b.documentId));
  return out as TemplateBookDocPatchDTO[];
}

/**
 * ✅ THE REAL FIX:
 * Build docPatches from the selected template documents + their items
 * so backend never gets [] (unless template truly has no items).
 */
function buildDocPatchesFromTemplateDocs(docs: any[]): TemplateBookDocPatchDTO[] {
  const out: any[] = [];

  for (const d of docs ?? []) {
    const documentId = normDocDocumentId(d) || normTemplateDocId(d);
    if (!documentId) continue;

    const addItems = normTemplateDocItems(d)
      .map((x) => ({ itemId: x.itemId, quantity: x.quantity }))
      .filter((x) => x.itemId && x.quantity > 0);

    out.push({ documentId, addItems });
  }

  out.sort((a, b) => Number(a.documentId) - Number(b.documentId));
  return out as TemplateBookDocPatchDTO[];
}

export default function SessionEntryEditor() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = num(params.id);
  const partnerId = num(params.partnerId);

  // reset local UI state on param change
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateResponseDTO | null>(null);
  const hydratedKeyRef = useRef<string>("");
  const builtKeyRef = useRef<string>("");

  useEffect(() => {
    setSelectedTemplate(null);
    hydratedKeyRef.current = "";
    builtKeyRef.current = "";
  }, [sessionId, partnerId]);

  // ensure draft exists immediately
  useEffect(() => {
    if (!sessionId || !partnerId) return;
    ensureDraft(sessionId, partnerId);
  }, [sessionId, partnerId]);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;
  const warehouseId = num((session as any)?.warehouseId ?? 0) || null;

  const upsertM = useUpsertBookingSessionEntry(sessionId);
  const draft = useEntryDraft(sessionId, partnerId);

  // partner name
  const [partnerName, setPartnerName] = useState<string>("");

  // NOTE sheet
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const openNote = () => {
    const cur = isBlankNote((draft as any)?.note) ? "" : String((draft as any)?.note ?? "");
    setNoteDraft(cur);
    setNoteSheetOpen(true);
  };

  const applyNote = () => {
    const cleaned = sanitizeNote(noteDraft);
    patchDraft(sessionId, partnerId, { note: cleaned ? cleaned : null } as any);
    setNoteSheetOpen(false);
    setNoteDraft("");
  };

  const clearNote = () => setNoteDraft("");

  // item directory paging (best-effort names)
  const [metaById, setMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());
  const [namesLoading, setNamesLoading] = useState(false);
  const [metaPage, setMetaPage] = useState(0);

  const itemsQ = useItemsPage({
    warehouseId: warehouseId ? num(warehouseId) : null,
    page: metaPage,
    size: ITEMS_PAGE_SIZE,
    q: undefined,
  });

  useEffect(() => {
    if (itemsQ.data?.items?.length) setMetaById((prev) => upsertMetaMap(prev, itemsQ.data!.items as any));
  }, [itemsQ.data?.items]);

  // prefill partner name
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hitFromSession = ((session as any)?.entries ?? []).find((e: any) => num(e.partnerId) === num(partnerId)) ?? null;
        const maybeName = cleanText((hitFromSession as any)?.partnerName) || cleanText((hitFromSession as any)?.partner?.name) || "";
        if (maybeName) {
          if (!alive) return;
          setPartnerName(maybeName);
          return;
        }

        const res = await partnerService.pagePartners({ page: 0, size: 50, q: String(partnerId) });
        const hit = (res.items ?? []).find((p: any) => num(p.id) === num(partnerId)) ?? null;
        if (!alive) return;
        setPartnerName(cleanText((hit as any)?.name) || "");
      } catch {
        if (!alive) return;
        setPartnerName("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [partnerId, session?.id, (session as any)?.entries?.length]);

  const headerTitle = partnerName?.trim() ? `Unos • ${partnerName}` : `Unos • Partner #${partnerId}`;

  /**
   * Hydrate draft from backend entry ONCE per (sessionId, partnerId),
   * but NEVER overwrite user-touched fields.
   */
  useEffect(() => {
    if (!sessionId || !partnerId) return;
    if (!session) return;

    const key = `${sessionId}:${partnerId}:${(session as any)?.id ?? ""}`;
    if (hydratedKeyRef.current === key) return;

    const cur = getDraft(sessionId, partnerId) ?? ensureDraft(sessionId, partnerId);
    const touched = (cur as any)._touched ?? {};

    const existing =
      ((session as any).entries ?? []).find((e: any) => num(e.partnerId) === num(partnerId)) as BookingSessionEntryResponseDTO | undefined;

    if (!existing) {
      hydratedKeyRef.current = key;
      return;
    }

    const incomingTemplateId = (existing as any)?.templateId != null ? num((existing as any).templateId) : null;

    const incomingDocPatches = normalizeDocPatches(
      (existing as any)?.docPatches ??
        (existing as any)?.doc_patches ??
        (existing as any)?.docPatchesJson ??
        (existing as any)?.doc_patches_json ??
        null
    );
    const curDocPatches = normalizeDocPatches((cur as any)?.docPatches ?? null);

    const incomingStandalone = itemsToQtyMap(
      (existing as any)?.extraItems ??
        (existing as any)?.extra_items ??
        (existing as any)?.extraItemsJson ??
        (existing as any)?.extra_items_json ??
        null
    );

    const incomingNote = isBlankNote((existing as any)?.note) ? null : cleanText((existing as any)?.note);
    const incomingDocDate = (existing as any)?.documentDate ?? null;

    const merged = {
      ...cur,
      draftMode: ((cur as any)?.draftMode ?? (existing as any)?.draftMode ?? "DRAFT") as any,

      templateId: touched.templateId ? cur.templateId : cur.templateId ?? incomingTemplateId,

      docPatches: touched.docPatches ? curDocPatches : curDocPatches.length ? curDocPatches : incomingDocPatches,

      standaloneQty: touched.standaloneQty
        ? cur.standaloneQty ?? {}
        : cur.standaloneQty && Object.keys(cur.standaloneQty).length > 0
          ? cur.standaloneQty
          : incomingStandalone,

      note: touched.note ? cur.note ?? null : cur.note != null ? cur.note : incomingNote,

      documentDate: touched.documentDate ? ((cur as any)?.documentDate ?? null) : ((cur as any)?.documentDate ?? incomingDocDate),
    };

    setDraft(merged as any);
    hydratedKeyRef.current = key;
  }, [session?.id, sessionId, partnerId]);

  // load selected template full (from draft.templateId)
  useEffect(() => {
    let alive = true;
    (async () => {
      const tplId = num((draft as any)?.templateId ?? 0);
      if (!tplId) {
        setSelectedTemplate(null);
        return;
      }
      try {
        const full = await dispatchTemplateService.getTemplate(tplId);
        if (!alive) return;
        setSelectedTemplate(full as any);
      } catch {
        if (!alive) return;
        setSelectedTemplate(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [draft?.templateId]);

  const templateDocs: TemplateDocResponseDTO[] = useMemo(
    () => (((selectedTemplate as any)?.documents ?? (selectedTemplate as any)?.docs ?? []) as any[]),
    [selectedTemplate]
  );

  const templateDocsKey = useMemo(() => {
    return (templateDocs ?? [])
      .map((d: any) => {
        const id = normDocDocumentId(d) || normTemplateDocId(d);
        const cnt = normTemplateDocItems(d).length;
        return `${id}:${cnt}`;
      })
      .join("|");
  }, [templateDocs]);

  /**
   * ✅ FIX: Auto-build docPatches from template docs/items
   * - only when:
   *    - template is loaded
   *    - docPatches is currently empty
   *    - user did NOT touch docPatches (so we don’t overwrite manual edits)
   */
  useEffect(() => {
    if (!sessionId || !partnerId) return;

    const cur = getDraft(sessionId, partnerId);
    if (!cur) return;

    const tplId = num(cur.templateId ?? 0);
    if (!tplId) return;

    const loadedTplId = num((selectedTemplate as any)?.id ?? 0);
    if (!loadedTplId || loadedTplId !== tplId) return;

    const touched = (cur as any)._touched ?? {};
    if (touched.docPatches) return;

    const curNorm = normalizeDocPatches((cur as any).docPatches ?? null);
    if (curNorm.length) return;

    const built = buildDocPatchesFromTemplateDocs(templateDocs as any);
    // IMPORTANT: if template truly has no items, built will be [] (that’s correct)
    const k = `${sessionId}:${partnerId}:${tplId}:${templateDocsKey}`;
    if (builtKeyRef.current === k) return;

    // use setDraft => do NOT mark as touched
    setDraft({ ...cur, docPatches: built } as any);
    builtKeyRef.current = k;
  }, [sessionId, partnerId, (draft as any)?.templateId, (selectedTemplate as any)?.id, templateDocsKey]);

  const defaultDocId = useMemo(() => {
    const first: any = templateDocs?.[0];
    const docId = normDocDocumentId(first) || normTemplateDocId(first);
    return docId || null;
  }, [templateDocs]);

  const defaultRowsByDoc = useMemo(() => {
    return (templateDocs ?? [])
      .map((d: any) => {
        const docId = normDocDocumentId(d) || normTemplateDocId(d);
        const rows = normTemplateDocItems(d).map((x) => ({ itemId: x.itemId, quantity: x.quantity }));
        return { docId, rows, count: rows.length };
      })
      .filter((x) => x.docId);
  }, [templateDocs]);

  const standaloneItems = useMemo(() => qtyToItems((draft as any)?.standaloneQty ?? {}), [draft?.standaloneQty]);

  const requiredItemIds = useMemo(() => {
    const ids: number[] = [];
    for (const d of templateDocs ?? []) for (const it of normTemplateDocItems(d)) if (it.itemId) ids.push(it.itemId);
    for (const it of standaloneItems ?? []) if (num((it as any)?.itemId)) ids.push(num((it as any).itemId));
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, [templateDocs, standaloneItems]);

  // preload item names
  const preloadKeyRef = useRef<string>("");
  useEffect(() => {
    if (!warehouseId) return;
    if (!requiredItemIds.length) return;

    const missing = requiredItemIds.filter((id) => !metaById.get(id)?.name?.trim());
    const key = `${warehouseId}:${missing.join(",")}`;

    if (!missing.length) {
      setNamesLoading(false);
      preloadKeyRef.current = "";
      return;
    }
    if (preloadKeyRef.current === key) return;

    preloadKeyRef.current = key;
    setNamesLoading(true);
    setMetaPage(0);
  }, [warehouseId, requiredItemIds, metaById]);

  useEffect(() => {
    if (!namesLoading) return;
    if (!warehouseId) return;
    if (itemsQ.isLoading) return;

    const missing = requiredItemIds.filter((id) => !metaById.get(id)?.name?.trim());
    if (!missing.length) {
      setNamesLoading(false);
      return;
    }

    const got = itemsQ.data?.items?.length ?? 0;
    const total = itemsQ.data?.total ?? 0;
    const size = itemsQ.data?.size ?? ITEMS_PAGE_SIZE;
    const page = itemsQ.data?.page ?? metaPage;
    const totalPages = Math.max(1, Math.ceil(total / size));

    if (page + 1 < totalPages && got > 0) {
      setMetaPage((p) => p + 1);
      return;
    }

    setNamesLoading(false);
  }, [
    namesLoading,
    itemsQ.isLoading,
    itemsQ.data?.items?.length,
    itemsQ.data?.total,
    itemsQ.data?.page,
    itemsQ.data?.size,
    requiredItemIds,
    metaById,
    warehouseId,
    metaPage,
  ]);

  const namesReady = useMemo(() => {
    if (!requiredItemIds.length) return true;
    for (const id of requiredItemIds) if (!metaById.get(id)?.name?.trim()) return false;
    return true;
  }, [requiredItemIds, metaById]);

  const err = (sQ.error as any)?.message || (upsertM.error as any)?.message || null;

  const openTemplatePicker = () => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/template" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const openStandaloneItems = () => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/items" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const goBackToSessionEntriesList = () => {
    router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
  };

  const save = async () => {
    if (!session || (session as any).status !== "DRAFT") return;

    const cur = getDraft(sessionId, partnerId);
    if (!cur) return;

    const tplId = num(cur.templateId ?? 0);
    if (!tplId) return;

    // ✅ ALWAYS build docPatches if empty (template defaults must be sent)
    let docPatchesOut = normalizeDocPatches((cur as any).docPatches ?? null);

    if (!docPatchesOut.length) {
      // try from already loaded template
      const loadedTplId = num((selectedTemplate as any)?.id ?? 0);
      if (loadedTplId === tplId) {
        docPatchesOut = buildDocPatchesFromTemplateDocs(templateDocs as any);
      } else {
        // hard fallback: fetch template now
        try {
          const tpl = await dispatchTemplateService.getTemplate(tplId);
          const docs = ((tpl as any)?.documents ?? (tpl as any)?.docs ?? []) as any[];
          docPatchesOut = buildDocPatchesFromTemplateDocs(docs);
        } catch {
          docPatchesOut = [];
        }
      }

      // keep store consistent if user didn’t touch docPatches
      const cur2 = getDraft(sessionId, partnerId);
      if (cur2 && !((cur2 as any)?._touched?.docPatches)) {
        setDraft({ ...cur2, docPatches: docPatchesOut } as any);
      }
    }

    const extraItemsOut = qtyToItems(cur.standaloneQty ?? {});
    const noteOut = isBlankNote(cur.note) ? null : sanitizeNote(String(cur.note ?? ""));

    // ✅ SEND docPatches ALWAYS (this is the actual fix)
    const payload: any = {
      partnerId: num(cur.partnerId),
      templateId: tplId,
      draftMode: (cur.draftMode ?? "DRAFT") as any,
      documentDate: (cur as any).documentDate ?? null,

      docPatches: docPatchesOut as any,
      extraItems: extraItemsOut as any,

      // keep if your generated client type expects it
      extraDocuments: [] as any,

      note: noteOut ? noteOut : null,
    };

    await upsertM.mutateAsync(payload as BookingSessionEntryUpsertRequestDTO);

    clearDraft(sessionId, partnerId);
    await sQ.refetch();
    goBackToSessionEntriesList();
  };

  if (!draft) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <NavigationHeader title="Unos" fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }} />
        <View style={{ padding: 16, alignItems: "center", gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ color: Colors.sub, fontWeight: "800" }}>Učitavam…</Text>
        </View>
      </Screen>
    );
  }

  const noteValue = isBlankNote((draft as any)?.note) ? "" : String((draft as any)?.note ?? "");
  const noteClean = noteValue.trim();
  const hasNote = !!noteClean;
  const noteLines = countLines(noteClean);
  const notePreview = shorten(firstLine(noteClean), 72);

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader title={headerTitle} fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        {!!err && <Banner type="error" text={String(err)} />}

        <Text style={st.label}>Način</Text>
        <View style={st.segmentRow}>
          <Pressable style={[st.segBtn, draft.draftMode === "DRAFT" && st.segBtnOn]} onPress={() => patchDraft(sessionId, partnerId, { draftMode: "DRAFT" })}>
            <Text style={[st.segText, draft.draftMode === "DRAFT" && st.segTextOn]}>Draft</Text>
          </Pressable>

          <Pressable style={[st.segBtn, draft.draftMode === "FINAL" && st.segBtnOn]} onPress={() => patchDraft(sessionId, partnerId, { draftMode: "FINAL" })}>
            <Text style={[st.segText, draft.draftMode === "FINAL" && st.segTextOn]}>Final</Text>
          </Pressable>
        </View>

        {/* NOTE */}
        <Text style={st.label}>Napomena</Text>

        <Pressable style={[st.noteCard, !hasNote && st.noteCardEmpty]} onPress={openNote}>
          <View style={st.noteIconBox}>
            <FontAwesome name="sticky-note" size={14} color={Colors.text} />
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={st.noteTitle}>{hasNote ? "Napomena dodana" : "Dodaj napomenu"}</Text>

              {hasNote ? (
                <View style={st.notePill}>
                  <Text style={st.notePillText}>{noteLines > 1 ? `${noteLines} linije` : "1 linija"}</Text>
                </View>
              ) : (
                <View style={[st.notePill, { backgroundColor: "rgba(148,163,184,0.12)", borderColor: "rgba(148,163,184,0.22)" }]}>
                  <Text style={st.notePillText}>Opcionalno</Text>
                </View>
              )}
            </View>

            {hasNote ? (
              <Text style={st.notePreview} numberOfLines={2}>
                {noteLines > 1 ? `${notePreview}…` : shorten(noteClean, 120)}
              </Text>
            ) : (
              <Text style={st.noteHint} numberOfLines={2}>
                Npr. “Dostaviti do 12h”, “Nazvati prije dostave”…
              </Text>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={st.noteAction}>{hasNote ? "Uredi" : "Dodaj"}</Text>
              <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
            </View>
          </View>
        </Pressable>

        <View style={st.sectionHeader}>
          <Text style={st.label}>Predložak</Text>
          <Pressable style={st.smallBtn} onPress={openTemplatePicker}>
            <Text style={st.smallBtnText}>{draft.templateId ? "Promijeni" : "Odaberi"}</Text>
          </Pressable>
        </View>

        {selectedTemplate ? (
          <View style={[st.pickRow, st.pickRowSelected]}>
            <View style={{ flex: 1 }}>
              <Text style={st.pickTitle}>{(selectedTemplate as any).name}</Text>
              <Text style={st.pickSub}>#{(selectedTemplate as any).id} • dokumenata: {templateDocs?.length ?? 0}</Text>
            </View>

            <Pressable
              style={st.iconBtn}
              onPress={() => {
                patchDraft(sessionId, partnerId, { templateId: null, docPatches: [], standaloneQty: {}, note: null } as any);
                setSelectedTemplate(null);
              }}
            >
              <FontAwesome name="trash" size={16} color={Colors.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={st.helper}>Nije odabran predložak.</Text>
        )}

        {selectedTemplate ? (
          <>
            <Text style={st.label}>Dokumenti (iz predloška)</Text>

            {namesLoading ? (
              <View style={st.loadingBox}>
                <ActivityIndicator />
                <Text style={st.helper}>Učitavam nazive stavki…</Text>
              </View>
            ) : defaultRowsByDoc.length === 0 ? (
              <Text style={st.helper}>Predložak nema dokumenata / stavki.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {defaultRowsByDoc.map((block) => (
                  <View key={String(block.docId)} style={st.cardCol}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.title}>Dokument #{block.docId}</Text>
                        <Text style={st.sub}>Stavki: {block.count}</Text>
                      </View>

                      {defaultDocId && block.docId === defaultDocId ? (
                        <View style={st.pill}>
                          <Text style={st.pillText}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>

                    {block.count === 0 ? (
                      <Text style={st.muted}>Nema stavki.</Text>
                    ) : (
                      <View style={{ gap: 8, marginTop: 10 }}>
                        {block.rows.map((r) => {
                          const nm = itemName(r.itemId, metaById);
                          const meta = itemMeta(r.itemId, metaById);

                          return (
                            <View key={String(r.itemId)} style={st.simpleRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={st.itemNameStrong} numberOfLines={2}>
                                  {nm}
                                </Text>
                                {!!meta && (
                                  <Text style={st.itemMeta} numberOfLines={1}>
                                    {meta}
                                  </Text>
                                )}
                              </View>
                              <Text style={st.simpleRight}>x{r.quantity}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {!namesReady ? <Text style={[st.muted, { marginTop: 6 }]}>Neki artikli nemaju naziv (prikazujem Item #id).</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        <View style={st.sectionHeader}>
          <Text style={st.label}>Dodatne stavke (van dokumenta)</Text>
          <Pressable style={st.smallBtn} onPress={openStandaloneItems} disabled={!draft.templateId}>
            <Text style={st.smallBtnText}>{standaloneItems.length ? `Uredi (${standaloneItems.length})` : "+ Dodaj"}</Text>
          </Pressable>
        </View>

        {!draft.templateId ? (
          <Text style={st.helper}>Prvo odaberi predložak pa dodaj stavke.</Text>
        ) : (
          <View style={st.cardCol}>
            <Text style={st.title}>Dodatne stavke</Text>
            <Text style={st.sub}>
              Stavki: {standaloneItems.length}
              {!!defaultDocId ? ` • (dokumenti u predlošku: ${defaultRowsByDoc.length})` : ""}
            </Text>

            {standaloneItems.length === 0 ? (
              <Text style={st.muted}>Nema dodanih stavki.</Text>
            ) : (
              <View style={{ gap: 8, marginTop: 10 }}>
                {standaloneItems.map((r) => {
                  const nm = itemName(num(r.itemId), metaById);
                  const meta = itemMeta(num(r.itemId), metaById);

                  return (
                    <View key={String(r.itemId)} style={st.simpleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.itemNameStrong} numberOfLines={2}>
                          {nm}
                        </Text>
                        {!!meta && (
                          <Text style={st.itemMeta} numberOfLines={1}>
                            {meta}
                          </Text>
                        )}
                      </View>
                      <Text style={st.simpleRight}>x{Number(r.quantity ?? 0)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Pressable
          style={[st.primaryBtn, (!draft.templateId || upsertM.isPending || namesLoading) && { opacity: 0.5 }]}
          disabled={!draft.templateId || upsertM.isPending || namesLoading}
          onPress={save}
        >
          {upsertM.isPending ? <ActivityIndicator /> : <Text style={st.primaryText}>Spremi</Text>}
        </Pressable>

        <Pressable
          style={[st.ghostBtn, upsertM.isPending && { opacity: 0.6 }]}
          disabled={upsertM.isPending}
          onPress={() => {
            if (upsertM.isPending) return;
            clearDraft(sessionId, partnerId);
            goBackToSessionEntriesList();
          }}
        >
          <Text style={st.ghostText}>Zatvori</Text>
        </Pressable>
      </ScrollView>

      {/* NOTE SHEET */}
      <CenterSheet
        visible={noteSheetOpen}
        title="Napomena"
        onClose={() => {
          if (upsertM.isPending) return;
          setNoteSheetOpen(false);
          setNoteDraft("");
        }}
        closeOnBackdrop={false}
        disableClose={upsertM.isPending}
        width={MAX_W}
      >
        {!!partnerName?.trim() ? (
          <Text style={{ fontWeight: "800", color: Colors.sub, marginBottom: 10 }}>
            {partnerName} • #{partnerId}
          </Text>
        ) : (
          <Text style={{ fontWeight: "800", color: Colors.sub, marginBottom: 10 }}>Partner #{partnerId}</Text>
        )}

        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Upiši napomenu (npr. 'Dostaviti do 12h', 'Nazvati prije dostave'...)"
          placeholderTextColor={PLACEHOLDER}
          style={st.noteInput}
          multiline
          textAlignVertical="top"
          autoCorrect={false}
        />

        <View style={{ gap: 12 }}>
          <Pressable style={st.primaryBtn} onPress={applyNote} disabled={upsertM.isPending}>
            <Text style={st.primaryText}>Spremi napomenu</Text>
          </Pressable>

          <Pressable
            style={st.ghostBtn}
            onPress={() => {
              if (upsertM.isPending) return;
              setNoteSheetOpen(false);
              setNoteDraft("");
            }}
            disabled={upsertM.isPending}
          >
            <Text style={st.ghostText}>Zatvori</Text>
          </Pressable>

          <Pressable style={st.smallBtn} onPress={clearNote} disabled={upsertM.isPending}>
            <Text style={st.smallBtnText}>Obriši unos</Text>
          </Pressable>
        </View>
      </CenterSheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 14, gap: 12, alignSelf: "center", width: "100%", maxWidth: MAX_W },
  helper: { color: Colors.sub, fontWeight: "800" },
  label: { fontWeight: "900", color: Colors.text },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  primaryBtn: { paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", justifyContent: "center", marginTop: 2 },
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

  // note card
  noteCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  noteCardEmpty: {
    backgroundColor: "rgba(148,163,184,0.08)",
    borderColor: "rgba(148,163,184,0.28)",
  },
  noteIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  noteTitle: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  notePreview: { color: Colors.sub, fontWeight: "800", lineHeight: 18 },
  noteHint: { color: Colors.sub, fontWeight: "800", opacity: 0.9, lineHeight: 18 },
  noteAction: { fontWeight: "900", color: Colors.text },

  notePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.25)",
  },
  notePillText: { fontWeight: "900", color: Colors.text },

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
  pickRowSelected: { borderColor: Colors.orange, backgroundColor: "rgba(249,115,22,0.10)" },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "800" },

  iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },

  loadingBox: { width: "100%", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg, padding: 16, alignItems: "center", justifyContent: "center", gap: 10 },

  cardCol: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14, gap: 10 },

  title: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  sub: { color: Colors.sub, fontWeight: "800" },
  muted: { color: Colors.sub, fontWeight: "700" },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.15)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(34,197,94,0.35)" },
  pillText: { fontWeight: "900", color: Colors.text },

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

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  segmentRow: { flexDirection: "row", gap: 10 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: "rgba(148,163,184,0.12)", alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" },
  segText: { fontWeight: "900", color: Colors.sub },
  segTextOn: { color: Colors.text },
});
