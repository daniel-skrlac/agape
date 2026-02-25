import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import { CenterSheet } from "@/components/CenterSheet";
import { ErrorCard } from "@/components/ErrorCard";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  ItemDescriptorResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  TemplateDocResponseDTO,
  TemplateItemResponseDTO,
  TemplateResponseDTO,
} from "@/app/models/generated";

import { toUserMessage } from "@/app/api/apiClient";
import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession, useUpsertBookingSessionEntry } from "@/app/api/hooks/sessions/useBookingSessions";
import { useTemplateDetail } from "@/app/api/hooks/templates/useDispatchTemplates";
import { useItemDirectoryPickerPage } from "@/app/api/hooks/documents/useItemDirectoryPickerPage";

import {
  QtyMap,
  StandaloneMetaMap,
  useEntryDraft,
  getDraft,
  setDraft,
  clearDraft,
  patchDraft,
  ensureDraft,
} from "../_entryDraftStore";

const MAX_W = 560;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function cleanText(v: unknown) {
  const s = String(v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) return s.slice(1, -1);
  return s;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/[\s,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isBlankNote(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  const s = cleanText(v);
  if (!s) return true;
  return s.replace(/\s/g, "") === "[]";
}

function sanitizeNote(v: string) {
  return (v ?? "").replace(/\r\n/g, "\n").trim();
}

function shorten(s: string, max = 90) {
  const x = (s ?? "").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1)}…`;
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

function safeJsonAny(v: unknown): any {
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

function safeJsonArray(v: unknown): any[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  const parsed = safeJsonAny(v);
  return Array.isArray(parsed) ? parsed : [];
}

function normDocDocumentId(d: any): number {
  return num(d?.documentId ?? d?.document_id ?? d?.document?.id ?? d?.document?.documentId ?? 0);
}

function normTemplateDocId(d: any): number {
  return num(d?.id ?? d?.templateDocId ?? d?.template_doc_id ?? 0);
}

function normItemId(x: any): number {
  return num(x?.itemId ?? x?.item_id ?? x?.id ?? x?.item?.id ?? 0);
}

function qtyToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty ?? {})
    .map(([k, v]) => ({ itemId: num(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => a.itemId - b.itemId);
}

function normalizeDocPatches(raw: unknown): TemplateBookDocPatchDTO[] {
  if (raw == null) return [];

  let arr: any[] = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    const parsed = safeJsonAny(raw);
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && typeof parsed === "object") arr = [parsed];
  } else if (typeof raw === "object") {
    const maybeDocId = num(
      (raw as any)?.documentId ??
        (raw as any)?.document_id ??
        (raw as any)?.docId ??
        (raw as any)?.doc_id ??
        (raw as any)?.document?.id ??
        0
    );

    if (maybeDocId) {
      arr = [raw];
    } else {
      arr = Object.entries(raw as any).map(([k, v]) => ({ documentId: num(k), addItems: v }));
    }
  }

  const docMap = new Map<number, Map<number, number>>();

  for (const p of arr) {
    const documentId = num(p?.documentId ?? p?.document_id ?? p?.docId ?? p?.doc_id ?? p?.document?.id ?? 0);
    if (!documentId) continue;

    let addItemsRaw = p?.addItems ?? p?.add_items ?? p?.items ?? p?.lines ?? [];

    if (typeof addItemsRaw === "string") addItemsRaw = safeJsonAny(addItemsRaw) ?? [];

    if (addItemsRaw && typeof addItemsRaw === "object" && !Array.isArray(addItemsRaw)) {
      const w: any = addItemsRaw;
      if (w.addItems || w.items || w.lines) {
        addItemsRaw = w.addItems ?? w.items ?? w.lines ?? [];
      } else {
        addItemsRaw = Object.entries(w)
          .map(([k, v]) => ({ itemId: num(k), quantity: Number(v ?? 0) }))
          .filter((x) => x.itemId && x.quantity > 0);
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

  return Array.from(docMap.entries())
    .map(([documentId, itemMap]) => ({
      documentId,
      addItems: Array.from(itemMap.entries())
        .map(([itemId, quantity]) => ({ itemId, quantity }))
        .sort((a, b) => a.itemId - b.itemId),
    }))
    .sort((a, b) => a.documentId - b.documentId);
}

function templateDocRows(doc: TemplateDocResponseDTO) {
  const items = ((doc as any)?.items ?? []) as TemplateItemResponseDTO[];

  return (items ?? [])
    .map((row: any) => ({
      itemId: num(row?.itemId),
      quantity: Number(row?.quantity ?? 0),
      sortOrder: num(row?.sortOrder ?? 0) || 0,
      name: cleanText(row?.itemName ?? row?.name ?? ""),
      code: cleanText(row?.itemCode ?? row?.code ?? ""),
      unit: cleanText(row?.unit ?? ""),
      barcode: cleanText(row?.barcode ?? ""),
    }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.itemId - b.itemId));
}

function buildDocPatchesFromTemplateDocs(docs: TemplateDocResponseDTO[]): TemplateBookDocPatchDTO[] {
  return (docs ?? [])
    .map((d: any) => {
      const documentId = normDocDocumentId(d) || normTemplateDocId(d);
      const addItems = templateDocRows(d).map((x) => ({ itemId: x.itemId, quantity: x.quantity }));
      return { documentId, addItems };
    })
    .filter((x) => x.documentId)
    .sort((a, b) => a.documentId - b.documentId);
}

function extraItemsToState(items: unknown): { qty: QtyMap; metaById: StandaloneMetaMap } {
  const arr = safeJsonArray(items);
  const qty: QtyMap = {};
  const metaById: StandaloneMetaMap = {};

  for (const it of arr) {
    const itemId = normItemId(it);
    const quantity = Number(it?.quantity ?? it?.qty ?? 0);
    if (!itemId || quantity <= 0) continue;

    const k = String(itemId);
    qty[k] = (qty[k] ?? 0) + quantity;

    const name = cleanText(it?.name ?? it?.itemName ?? "");
    const code = cleanText(it?.code ?? it?.itemCode ?? "");
    const unit = cleanText(it?.unit ?? "");
    const barcode = cleanText(it?.barcode ?? "");

    if (name || code || unit || barcode) {
      metaById[k] = { itemId, name, code, unit, barcode };
    }
  }

  return { qty, metaById };
}

function hasKeys(v: Record<string, any> | null | undefined) {
  return !!v && Object.keys(v).length > 0;
}

function buildTemplateMetaMap(docs: TemplateDocResponseDTO[]) {
  const out: StandaloneMetaMap = {};
  for (const d of docs ?? []) {
    for (const r of templateDocRows(d)) {
      const k = String(r.itemId);
      if (!k || k === "0") continue;
      if (out[k]) continue;
      if (!r.name && !r.code && !r.unit && !r.barcode) continue;
      out[k] = { itemId: r.itemId, name: r.name, code: r.code, unit: r.unit, barcode: r.barcode };
    }
  }
  return out;
}

function metaToStandaloneMeta(it: ItemDescriptorResponseDTO | any) {
  const itemId = num(it?.itemId ?? it?.id ?? 0);
  if (!itemId) return null;

  const name = cleanText(it?.name ?? it?.itemName ?? "");
  const code = cleanText(it?.code ?? it?.itemCode ?? "");
  const unit = cleanText(it?.unit ?? "");
  const barcode = cleanText(it?.barcode ?? "");

  return { itemId, name, code, unit, barcode };
}

function mergeStandaloneMetaMaps(...maps: Array<StandaloneMetaMap | null | undefined>) {
  const out: StandaloneMetaMap = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (!v) continue;
      if (!out[k]) out[k] = v;
    }
  }
  return out;
}

function displayFromMeta(itemId: number, mergedMeta: StandaloneMetaMap) {
  const m = mergedMeta?.[String(itemId)];
  const name = cleanText(m?.name ?? "") || `Artikl #${itemId}`;
  const code = cleanText(m?.code ?? "");
  const unit = cleanText(m?.unit ?? "");
  const barcode = cleanText(m?.barcode ?? "");

  const meta = [
    code ? `Šifra: ${code}` : null,
    unit ? `JMJ: ${unit}` : null,
    barcode ? `BC: ${barcode}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return { name, meta };
}

export default function SessionEntryEditor() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = num(params.id);
  const partnerId = num(params.partnerId);

  const [partnerName, setPartnerName] = useState("");
  const [screenError, setScreenError] = useState<string | null>(null);

  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const hydratedKeyRef = useRef("");
  const builtKeyRef = useRef("");

  useEffect(() => {
    setPartnerName("");
    setScreenError(null);
    setNoteSheetOpen(false);
    setNoteDraft("");
    hydratedKeyRef.current = "";
    builtKeyRef.current = "";
  }, [sessionId, partnerId]);

  useEffect(() => {
    if (!sessionId || !partnerId) return;
    ensureDraft(sessionId, partnerId);
  }, [sessionId, partnerId]);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const upsertM = useUpsertBookingSessionEntry(sessionId);
  const draft = useEntryDraft(sessionId, partnerId);

  const isSessionDraft = String((session as any)?.status ?? "") === "DRAFT";
  const canEdit = !session || isSessionDraft;

  const warehouseId = num((session as any)?.warehouseId ?? 0) || null;

  const tplId = num((draft as any)?.templateId ?? 0) || null;
  const tplQ = useTemplateDetail(tplId, { includeItemMeta: true });
  const selectedTemplate = (tplQ.data ?? null) as TemplateResponseDTO | null;

  const templateDocs: TemplateDocResponseDTO[] = useMemo(
    () => ((selectedTemplate?.documents ?? []) as any),
    [selectedTemplate]
  );

  const templateMetaById = useMemo(() => buildTemplateMetaMap(templateDocs), [templateDocs]);

  const { fetchItemsPage } = useItemDirectoryPickerPage({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    enabled: !!warehouseId,
  });

  // Local cache for meta of extra items (so extra items show name/code/unit/barcode)
  const [extraHydratedMetaById, setExtraHydratedMetaById] = useState<StandaloneMetaMap>({});

  const standaloneItems = useMemo(() => qtyToItems((draft as any)?.standaloneQty ?? {}), [draft?.standaloneQty]);
  const standaloneMetaById = ((draft as any)?.standaloneMetaById ?? {}) as StandaloneMetaMap;

  // Hydrate meta for extra items that are not in draft.standaloneMetaById and not in template meta
  useEffect(() => {
    let alive = true;

    if (!warehouseId) return;
    if (!standaloneItems.length) return;

    const mergedAlready = mergeStandaloneMetaMaps(standaloneMetaById, extraHydratedMetaById, templateMetaById);

    const missingIds = standaloneItems
      .map((x) => num((x as any)?.itemId))
      .filter((id) => id > 0)
      .filter((id) => !mergedAlready[String(id)]);

    if (!missingIds.length) return;

    (async () => {
      // avoid spamming if someone adds 200 items
      const ids = missingIds.slice(0, 40);

      const nextPatch: StandaloneMetaMap = {};

      for (const id of ids) {
        if (!alive) return;

        try {
          const res = await fetchItemsPage({
            page: 0,
            size: 25,
            q: String(id),
          });

          const rows = (res?.items ?? []) as ItemDescriptorResponseDTO[];
          const hit = rows.find((r: any) => num((r as any)?.itemId) === id) ?? rows[0];

          const meta = metaToStandaloneMeta(hit);
          if (meta) nextPatch[String(id)] = meta;
        } catch {
          // ignore single-item fetch failures
        }
      }

      if (!alive) return;
      if (Object.keys(nextPatch).length) {
        setExtraHydratedMetaById((prev) => ({ ...prev, ...nextPatch }));
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, standaloneItems, fetchItemsPage, templateMetaById, standaloneMetaById, extraHydratedMetaById]);

  const mergedExtraMetaById = useMemo(
    () => mergeStandaloneMetaMaps(standaloneMetaById, extraHydratedMetaById, templateMetaById),
    [standaloneMetaById, extraHydratedMetaById, templateMetaById]
  );

  const topError = useMemo(() => {
    if (screenError) return screenError;
    if (sQ.error) return toUserMessage(sQ.error, "Greška pri učitavanju sesije.");
    if (tplQ.error) return toUserMessage(tplQ.error, "Greška pri učitavanju predloška.");
    if (upsertM.error) return toUserMessage(upsertM.error, "Greška pri spremanju unosa.");
    return null;
  }, [screenError, sQ.error, tplQ.error, upsertM.error]);

  const retryTopError = useCallback(async () => {
    setScreenError(null);
    await Promise.allSettled([sQ.refetch(), tplQ.refetch()]);
  }, [sQ, tplQ]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const hitFromSession = ((session as any)?.entries ?? []).find((e: any) => num(e.partnerId) === partnerId) ?? null;
        const maybeName = cleanText((hitFromSession as any)?.partnerName) || cleanText((hitFromSession as any)?.partner?.name) || "";

        if (maybeName) {
          if (alive) setPartnerName(maybeName);
          return;
        }

        const res = await partnerService.pagePartners({ page: 0, size: 50, q: String(partnerId) });
        const hit = (res.items ?? []).find((p: any) => num(p.id) === partnerId) ?? null;
        if (alive) setPartnerName(cleanText((hit as any)?.name) || "");
      } catch {
        if (alive) setPartnerName("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [partnerId, session?.id, (session as any)?.entries?.length]);

  const headerTitle = partnerName?.trim() ? `Unos • ${partnerName}` : `Unos • Partner #${partnerId}`;

  useEffect(() => {
    if (!sessionId || !partnerId || !session) return;

    const key = `${sessionId}:${partnerId}:${(session as any)?.id ?? ""}`;
    if (hydratedKeyRef.current === key) return;

    const cur = getDraft(sessionId, partnerId) ?? ensureDraft(sessionId, partnerId);
    const touched = (cur as any)._touched ?? {};

    const existing = ((session as any).entries ?? []).find(
      (e: any) => num(e.partnerId) === partnerId
    ) as BookingSessionEntryResponseDTO | undefined;

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

    const incomingExtra = extraItemsToState(
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
          : incomingExtra.qty,
      standaloneMetaById: touched.standaloneMetaById
        ? (cur as any).standaloneMetaById ?? {}
        : hasKeys((cur as any).standaloneMetaById)
          ? (cur as any).standaloneMetaById
          : incomingExtra.metaById,
      note: touched.note ? cur.note ?? null : cur.note != null ? cur.note : incomingNote,
      documentDate: touched.documentDate ? ((cur as any)?.documentDate ?? null) : ((cur as any)?.documentDate ?? incomingDocDate),
    };

    setDraft(merged as any);
    hydratedKeyRef.current = key;
  }, [sessionId, partnerId, session]);

  const templateDocsKey = useMemo(() => {
    return (templateDocs ?? [])
      .map((d: any) => {
        const docId = normDocDocumentId(d) || normTemplateDocId(d);
        const rows = templateDocRows(d);
        const rowsKey = rows.map((r) => `${r.itemId}:${r.quantity}`).join(",");
        return `${docId}|${rowsKey}`;
      })
      .join(";");
  }, [templateDocs]);

  useEffect(() => {
    if (!sessionId || !partnerId) return;

    const cur = getDraft(sessionId, partnerId);
    if (!cur) return;

    const curTplId = num((cur as any).templateId ?? 0);
    if (!curTplId) return;

    const loadedTplId = num((selectedTemplate as any)?.id ?? 0);
    if (!loadedTplId || loadedTplId !== curTplId) return;

    const touched = (cur as any)._touched ?? {};
    if (touched.docPatches) return;

    const curNorm = normalizeDocPatches((cur as any).docPatches ?? null);
    if (curNorm.length) return;

    const built = buildDocPatchesFromTemplateDocs(templateDocs);
    const k = `${sessionId}:${partnerId}:${curTplId}:${templateDocsKey}`;
    if (builtKeyRef.current === k) return;

    setDraft({ ...cur, docPatches: built } as any);
    builtKeyRef.current = k;
  }, [sessionId, partnerId, selectedTemplate, templateDocsKey, templateDocs]);

  const defaultDocId = useMemo(() => {
    const first: any = templateDocs?.[0];
    const docId = normDocDocumentId(first) || normTemplateDocId(first);
    return docId || null;
  }, [templateDocs]);

  const templateBlocks = useMemo(() => {
    return (templateDocs ?? [])
      .map((d: any) => {
        const docId = normDocDocumentId(d) || normTemplateDocId(d);
        const rows = templateDocRows(d);
        return { docId, rows, count: rows.length };
      })
      .filter((x) => x.docId);
  }, [templateDocs]);

  const openNote = useCallback(() => {
    if (!canEdit) return;
    const cur = isBlankNote((draft as any)?.note) ? "" : String((draft as any)?.note ?? "");
    setNoteDraft(cur);
    setNoteSheetOpen(true);
  }, [canEdit, draft]);

  const closeNoteSheet = useCallback(() => {
    if (upsertM.isPending) return;
    setNoteSheetOpen(false);
    setNoteDraft("");
  }, [upsertM.isPending]);

  const applyNote = useCallback(() => {
    const cleaned = sanitizeNote(noteDraft);
    patchDraft(sessionId, partnerId, { note: cleaned ? cleaned : null } as any);
    setNoteSheetOpen(false);
    setNoteDraft("");
  }, [noteDraft, sessionId, partnerId]);

  const openTemplatePicker = useCallback(() => {
    if (!canEdit) return;
    router.push({
      pathname: "/(tabs)/sessions/[id]/template" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  }, [canEdit, sessionId, partnerId]);

  const openStandaloneItems = useCallback(() => {
    if (!canEdit) return;
    router.push({
      pathname: "/(tabs)/sessions/[id]/items" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  }, [canEdit, sessionId, partnerId]);

  const goBackToSessionEntriesList = useCallback(() => {
    router.replace({ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } });
  }, [sessionId]);

  const clearTemplateSelection = useCallback(() => {
    if (!canEdit) return;

    patchDraft(sessionId, partnerId, {
      templateId: null,
      docPatches: [],
      standaloneQty: {},
      standaloneMetaById: {},
      note: null,
    } as any);
  }, [canEdit, sessionId, partnerId]);

  const save = useCallback(async () => {
    if (!session || !isSessionDraft) return;

    const cur = getDraft(sessionId, partnerId);
    if (!cur) return;

    const curTplId = num((cur as any).templateId ?? 0);
    if (!curTplId) return;

    setScreenError(null);

    try {
      let docPatchesOut = normalizeDocPatches((cur as any).docPatches ?? null);

      if (!docPatchesOut.length) {
        if (selectedTemplate && num((selectedTemplate as any)?.id ?? 0) === curTplId) {
          docPatchesOut = buildDocPatchesFromTemplateDocs(templateDocs);
        }
      }

      const extraItemsOut = qtyToItems((cur as any).standaloneQty ?? {});
      const noteOut = isBlankNote((cur as any).note) ? null : sanitizeNote(String((cur as any).note ?? ""));

      const payload: BookingSessionEntryUpsertRequestDTO = {
        partnerId: num((cur as any).partnerId),
        templateId: curTplId,
        draftMode: (((cur as any).draftMode ?? "DRAFT") as any),
        documentDate: ((cur as any).documentDate ?? null) as any,
        docPatches: (docPatchesOut ?? []) as any,
        extraItems: extraItemsOut as any,
        note: (noteOut ? noteOut : null) as any,
      };

      await upsertM.mutateAsync(payload);

      clearDraft(sessionId, partnerId);
      await sQ.refetch();
      goBackToSessionEntriesList();
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri spremanju unosa."));
    }
  }, [session, isSessionDraft, sessionId, partnerId, selectedTemplate, templateDocs, upsertM, sQ, goBackToSessionEntriesList]);

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

  const tplLoading = !!tplId && (tplQ.isLoading || tplQ.isFetching);
  const saveDisabled = !draft.templateId || upsertM.isPending || !canEdit || tplLoading;
  const extraItemsDisabled = !draft.templateId || !canEdit;

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader title={headerTitle} fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Pokušaj ponovno"
            onAction={retryTopError}
            titleLines={1}
            messageLines={3}
          />
        )}

        {!!session && !isSessionDraft && (
          <Text style={st.helper}>Sesija nije u DRAFT statusu. Uređivanje je zaključano.</Text>
        )}

        <Text style={st.label}>Način</Text>
        <View style={st.segmentRow}>
          <Pressable
            style={[st.segBtn, draft.draftMode === "DRAFT" && st.segBtnOn, !canEdit && st.disabled]}
            onPress={() => canEdit && patchDraft(sessionId, partnerId, { draftMode: "DRAFT" })}
            disabled={!canEdit}
          >
            <Text style={[st.segText, draft.draftMode === "DRAFT" && st.segTextOn]}>Draft</Text>
          </Pressable>

          <Pressable
            style={[st.segBtn, draft.draftMode === "FINAL" && st.segBtnOn, !canEdit && st.disabled]}
            onPress={() => canEdit && patchDraft(sessionId, partnerId, { draftMode: "FINAL" })}
            disabled={!canEdit}
          >
            <Text style={[st.segText, draft.draftMode === "FINAL" && st.segTextOn]}>Final</Text>
          </Pressable>
        </View>

        <Text style={st.label}>Napomena</Text>

        <Pressable style={[st.noteCard, !hasNote && st.noteCardEmpty, !canEdit && st.disabled]} onPress={openNote} disabled={!canEdit}>
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
                <View style={[st.notePill, st.notePillOptional]}>
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
          <Pressable style={[st.smallBtn, !canEdit && st.smallBtnDisabled]} onPress={openTemplatePicker} disabled={!canEdit}>
            <Text style={[st.smallBtnText, !canEdit && st.smallBtnTextDisabled]}>{draft.templateId ? "Promijeni" : "Odaberi"}</Text>
          </Pressable>
        </View>

        {draft.templateId && tplLoading ? <Text style={st.helper}>Učitavam predložak…</Text> : null}

        {selectedTemplate ? (
          <View style={[st.pickRow, st.pickRowSelected]}>
            <View style={{ flex: 1 }}>
              <Text style={st.pickTitle}>{(selectedTemplate as any).name}</Text>
              <Text style={st.pickSub}>#{(selectedTemplate as any).id} • dokumenata: {templateDocs?.length ?? 0}</Text>
            </View>

            <Pressable style={[st.iconBtn, !canEdit && st.disabled]} onPress={clearTemplateSelection} disabled={!canEdit}>
              <FontAwesome name="trash" size={16} color={Colors.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={st.helper}>Nije odabran predložak.</Text>
        )}

        {selectedTemplate ? (
          <>
            <Text style={st.label}>Dokumenti (iz predloška)</Text>

            {templateBlocks.length === 0 ? (
              <Text style={st.helper}>Predložak nema dokumenata / stavki.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {templateBlocks.map((block) => (
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
                          const rowMeta = [
                            r.code ? `Šifra: ${r.code}` : null,
                            r.unit ? `JMJ: ${r.unit}` : null,
                            r.barcode ? `BC: ${r.barcode}` : null,
                          ]
                            .filter(Boolean)
                            .join(" • ");

                          return (
                            <View key={String(r.itemId)} style={st.simpleRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={st.itemNameStrong} numberOfLines={2}>
                                  {r.name || `Artikl #${r.itemId}`}
                                </Text>
                                {!!rowMeta && (
                                  <Text style={st.itemMeta} numberOfLines={1}>
                                    {rowMeta}
                                  </Text>
                                )}
                              </View>
                              <Text style={st.simpleRight}>x{r.quantity}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        <View style={st.sectionHeader}>
          <Text style={st.label}>Dodatne stavke (van dokumenta)</Text>
          <Pressable
            style={[st.smallBtn, extraItemsDisabled && st.smallBtnDisabled]}
            onPress={openStandaloneItems}
            disabled={extraItemsDisabled}
          >
            <Text style={[st.smallBtnText, extraItemsDisabled && st.smallBtnTextDisabled]}>
              {standaloneItems.length ? `Uredi (${standaloneItems.length})` : "+ Dodaj"}
            </Text>
          </Pressable>
        </View>

        {!draft.templateId ? (
          <Text style={st.helper}>Prvo odaberi predložak pa dodaj stavke.</Text>
        ) : (
          <View style={st.cardCol}>
            <Text style={st.title}>Dodatne stavke</Text>
            <Text style={st.sub}>
              Stavki: {standaloneItems.length}
              {!!warehouseId ? ` • skladište: ${warehouseId}` : ""}
            </Text>

            {standaloneItems.length === 0 ? (
              <Text style={st.muted}>Nema dodanih stavki.</Text>
            ) : (
              <View style={{ gap: 8, marginTop: 10 }}>
                {standaloneItems.map((r) => {
                  const itemId = num((r as any).itemId);
                  const quantity = Number((r as any).quantity ?? 0);
                  const display = displayFromMeta(itemId, mergedExtraMetaById);

                  return (
                    <View key={String(itemId)} style={st.simpleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.itemNameStrong} numberOfLines={2}>
                          {display.name}
                        </Text>
                        {!!display.meta && (
                          <Text style={st.itemMeta} numberOfLines={1}>
                            {display.meta}
                          </Text>
                        )}
                      </View>
                      <Text style={st.simpleRight}>x{quantity}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={[st.helper, { marginTop: 8 }]}>
              Ove stavke nisu vezane uz određeni dokument.
            </Text>
          </View>
        )}

        <Pressable style={[st.primaryBtn, saveDisabled && st.disabled]} disabled={saveDisabled} onPress={save}>
          {upsertM.isPending ? <ActivityIndicator /> : <Text style={st.primaryText}>Spremi</Text>}
        </Pressable>

        <Pressable
          style={[st.ghostBtn, upsertM.isPending && st.disabled]}
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

      <CenterSheet
        visible={noteSheetOpen}
        title="Napomena"
        onClose={closeNoteSheet}
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
          editable={!upsertM.isPending}
        />

        <View style={{ gap: 12 }}>
          <Pressable style={[st.primaryBtn, upsertM.isPending && st.disabled]} onPress={applyNote} disabled={upsertM.isPending}>
            <Text style={st.primaryText}>Spremi napomenu</Text>
          </Pressable>

          <Pressable style={[st.ghostBtn, upsertM.isPending && st.disabled]} onPress={closeNoteSheet} disabled={upsertM.isPending}>
            <Text style={st.ghostText}>Zatvori</Text>
          </Pressable>

          <Pressable
            style={[st.smallBtn, upsertM.isPending && st.smallBtnDisabled]}
            onPress={() => setNoteDraft("")}
            disabled={upsertM.isPending}
          >
            <Text style={[st.smallBtnText, upsertM.isPending && st.smallBtnTextDisabled]}>Obriši unos</Text>
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

  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
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
  smallBtnDisabled: {
    backgroundColor: "rgba(148,163,184,0.16)",
    borderColor: "rgba(148,163,184,0.28)",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },
  smallBtnTextDisabled: { color: Colors.sub },

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
  notePillOptional: {
    backgroundColor: "rgba(148,163,184,0.12)",
    borderColor: "rgba(148,163,184,0.22)",
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

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

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

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,197,94,0.35)",
  },
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

  disabled: { opacity: 0.5 },
});