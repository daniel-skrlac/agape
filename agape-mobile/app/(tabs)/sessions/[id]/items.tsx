import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";

import type {
  DocumentDescriptorResponseDTO,
  ItemDescriptorResponseDTO,
  TemplateBookItemDTO,
} from "@/src/models/generated";

import { toUserMessage } from "../../../../src/api//apiClient";
import { useBookingSession } from "../../../../src/api//hooks/sessions/useBookingSessions";
import { documentDirectoryService } from "../../../../src/api/services/documentDirectoryService";
import { itemDirectoryService } from "../../../../src/api/services/itemDirectoryService";
import { useCurrentUser } from "../../../../src/api/hooks/common/useCurrentUser";

import {
  QtyMap,
  StandaloneMetaMap,
  useEntryDraft,
  patchDraft,
} from "../../../../src/stores/entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";
const SEARCH_DEBOUNCE_MS = 220;

function cleanText(v: unknown) {
  return String(v ?? "").trim();
}

function normItemId(x: any) {
  return Number(x?.itemId ?? x?.id ?? x?.item_id ?? x?.item?.id ?? 0);
}

function normDocumentId(x: any) {
  return Number(x?.documentId ?? x?.document_id ?? x?.id ?? 0);
}

function descriptorTitle(doc: DocumentDescriptorResponseDTO | null | undefined) {
  if (!doc) return "Odaberi grupu dokumenta";
  const group = cleanText((doc as any)?.storageGroupName ?? "");
  const display = cleanText((doc as any)?.displayName ?? "");
  const code = cleanText((doc as any)?.documentCode ?? "");
  return group || display || code || `Dokument #${doc.documentId}`;
}

function descriptorSubtitle(doc: DocumentDescriptorResponseDTO | null | undefined) {
  if (!doc) return "Stavke se prikazuju po skladištu odabrane grupe.";
  return [
    cleanText((doc as any)?.displayName ?? ""),
    cleanText((doc as any)?.documentCode ?? ""),
    doc.documentId ? `Dokument #${doc.documentId}` : null,
    doc.warehouseId ? `Skladište #${doc.warehouseId}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function documentGroupRank(doc: DocumentDescriptorResponseDTO | null | undefined): number {
  const text = `${cleanText((doc as any)?.storageGroupName ?? "")} ${cleanText((doc as any)?.displayName ?? "")}`.toLowerCase();
  if (text.includes("socijalna")) return 0;
  if (text.includes("doniran")) return 1;
  return 2;
}

type DocumentTone = "social" | "donation" | "neutral";

function documentToneFromText(text: string): DocumentTone {
  const normalized = text.toLowerCase();
  if (normalized.includes("socijalna")) return "social";
  if (normalized.includes("doniran")) return "donation";
  return "neutral";
}

function documentTone(doc: DocumentDescriptorResponseDTO | null | undefined): DocumentTone {
  return documentToneFromText(
    `${cleanText((doc as any)?.storageGroupName ?? "")} ${cleanText((doc as any)?.displayName ?? "")}`
  );
}

function compareDocumentDescriptors(
  a: DocumentDescriptorResponseDTO | null | undefined,
  b: DocumentDescriptorResponseDTO | null | undefined
) {
  const rank = documentGroupRank(a) - documentGroupRank(b);
  if (rank !== 0) return rank;

  const name = cleanText((a as any)?.storageGroupName ?? (a as any)?.displayName ?? "")
    .localeCompare(cleanText((b as any)?.storageGroupName ?? (b as any)?.displayName ?? ""), "hr", { sensitivity: "base" });
  if (name !== 0) return name;

  const aw = Number((a as any)?.warehouseId ?? 0);
  const bw = Number((b as any)?.warehouseId ?? 0);
  if (aw !== bw) return aw - bw;

  return Number((a as any)?.documentId ?? 0) - Number((b as any)?.documentId ?? 0);
}

function filterDocumentDescriptors(
  docs: DocumentDescriptorResponseDTO[],
  q?: string | null
) {
  const query = cleanText(q ?? "").toLowerCase();
  if (!query) return docs;

  return docs.filter((doc) => {
    const haystack = [
      descriptorTitle(doc),
      descriptorSubtitle(doc),
      String((doc as any)?.documentId ?? ""),
      String((doc as any)?.warehouseId ?? ""),
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function mergeItemMeta(
  prev: Map<number, ItemDescriptorResponseDTO>,
  items: ItemDescriptorResponseDTO[] | null | undefined
) {
  const next = new Map(prev);

  for (const item of items ?? []) {
    const id = normItemId(item);
    if (!id) continue;
    next.set(id, item);
  }

  return next;
}

function formatItemDisplay(
  itemId: number,
  metaById: Map<number, ItemDescriptorResponseDTO>,
  row?: any
) {
  const rowName = cleanText(row?.name ?? row?.itemName ?? "");
  const rowCode = cleanText(row?.code ?? row?.itemCode ?? "");
  const rowUnit = cleanText(row?.unit ?? "");
  const rowBarcode = cleanText(row?.barcode ?? "");

  if (rowName || rowCode || rowUnit || rowBarcode) {
    const subtitle = [
      rowCode ? `Šifra: ${rowCode}` : null,
      rowUnit ? `JMJ: ${rowUnit}` : null,
      rowBarcode ? `BC: ${rowBarcode}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return { name: rowName || (itemId ? `Artikl #${itemId}` : "Artikl"), meta: subtitle };
  }

  const m: any = metaById.get(itemId);
  const name = cleanText(m?.name ?? "");
  const code = cleanText(m?.code ?? "");
  const unit = cleanText(m?.unit ?? "");
  const barcode = cleanText(m?.barcode ?? "");

  const subtitle = [
    code ? `Šifra: ${code}` : null,
    unit ? `JMJ: ${unit}` : null,
    barcode ? `BC: ${barcode}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return { name: name || (itemId ? `Artikl #${itemId}` : "Artikl"), meta: subtitle };
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
  return Object.entries(qty ?? {})
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => Number(a.itemId) - Number(b.itemId));
}

function itemMetaFields(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  const meta = metaById.get(itemId) as any;
  return {
    name: cleanText(meta?.name ?? ""),
    itemName: cleanText(meta?.name ?? ""),
    code: cleanText(meta?.code ?? ""),
    itemCode: cleanText(meta?.code ?? ""),
    unit: cleanText(meta?.unit ?? ""),
    barcode: cleanText(meta?.barcode ?? ""),
  };
}

function qtyToItemsWithMeta(qty: QtyMap, metaById: Map<number, ItemDescriptorResponseDTO>): TemplateBookItemDTO[] {
  return qtyToItems(qty).map((item: any) => {
    const itemId = Number(item.itemId);
    return {
      ...item,
      ...itemMetaFields(itemId, metaById),
    };
  }) as any;
}

function normalizeExtraDocs(raw: any): Array<{ documentId: number; items: TemplateBookItemDTO[] }> {
  const docs = Array.isArray(raw) ? raw : [];
  const out: Array<{ documentId: number; items: TemplateBookItemDTO[] }> = [];

  for (const doc of docs) {
    const documentId = normDocumentId(doc);
    if (!documentId) continue;
    const items = Array.isArray(doc?.items) ? doc.items : [];
    const byItem = new Map<number, any>();
    for (const item of items) {
        const itemId = normItemId(item);
        const quantity = Number(item?.quantity ?? 0);
        if (!itemId || quantity <= 0) continue;

        const existing = byItem.get(itemId) ?? {};
        byItem.set(itemId, {
          ...existing,
          ...item,
          itemId,
          quantity: Number(existing.quantity ?? 0) + quantity,
          name: cleanText(existing.name ?? "") || cleanText(item?.name ?? item?.itemName ?? ""),
          itemName: cleanText(existing.itemName ?? "") || cleanText(item?.itemName ?? item?.name ?? ""),
          code: cleanText(existing.code ?? "") || cleanText(item?.code ?? item?.itemCode ?? ""),
          itemCode: cleanText(existing.itemCode ?? "") || cleanText(item?.itemCode ?? item?.code ?? ""),
          unit: cleanText(existing.unit ?? "") || cleanText(item?.unit ?? ""),
          barcode: cleanText(existing.barcode ?? "") || cleanText(item?.barcode ?? ""),
        });
    }
    const normalized = Array.from(byItem.values())
      .map((item) => ({ ...item, itemId: Number(item.itemId), quantity: Number(item.quantity ?? 0) }))
      .sort((a, b) => Number(a.itemId) - Number(b.itemId));
    out.push({ documentId, items: normalized });
  }

  return out.filter((doc) => doc.items.length > 0);
}

function qtyForDocument(extraDocs: any, documentId: number | null): QtyMap {
  if (!documentId) return {};
  const doc = normalizeExtraDocs(extraDocs).find((x) => x.documentId === documentId);
  const qty: QtyMap = {};
  for (const item of doc?.items ?? []) {
    const itemId = normItemId(item);
    const quantity = Number((item as any)?.quantity ?? 0);
    if (itemId && quantity > 0) qty[String(itemId)] = quantity;
  }
  return qty;
}

function qtyByDocumentFromExtraDocs(extraDocs: any): Record<string, QtyMap> {
  const out: Record<string, QtyMap> = {};

  for (const doc of normalizeExtraDocs(extraDocs)) {
    if (!doc.documentId) continue;

    const qty: QtyMap = {};
    for (const item of doc.items ?? []) {
      const itemId = normItemId(item);
      const quantity = Number((item as any)?.quantity ?? 0);
      if (itemId && quantity > 0) qty[String(itemId)] = quantity;
    }

    if (Object.keys(qty).length) {
      out[String(doc.documentId)] = qty;
    }
  }

  return out;
}

function mergeQtyMapsForMeta(qtyByDocumentId: Record<string, QtyMap>, fallback: QtyMap): QtyMap {
  const out: QtyMap = {};

  for (const docQty of Object.values(qtyByDocumentId ?? {})) {
    for (const [itemId, quantity] of Object.entries(docQty ?? {})) {
      const q = Number(quantity ?? 0);
      if (!Number(itemId) || q <= 0) continue;
      out[itemId] = Math.max(Number(out[itemId] ?? 0), q);
    }
  }

  if (Object.keys(out).length) return out;
  return { ...(fallback ?? {}) };
}

function seedMetaMapFromStandaloneMeta(
  standaloneMetaById: StandaloneMetaMap | null | undefined
) {
  const out: ItemDescriptorResponseDTO[] = [];

  for (const v of Object.values(standaloneMetaById ?? {})) {
    const itemId = Number((v as any)?.itemId ?? 0);
    if (!itemId) continue;

    out.push({
      itemId,
      name: cleanText((v as any)?.name ?? ""),
      code: cleanText((v as any)?.code ?? ""),
      unit: cleanText((v as any)?.unit ?? ""),
      barcode: cleanText((v as any)?.barcode ?? ""),
    } as any);
  }

  return out;
}

function seedMetaMapFromExtraDocs(extraDocs: unknown) {
  const out: ItemDescriptorResponseDTO[] = [];

  for (const doc of normalizeExtraDocs(extraDocs)) {
    for (const item of doc.items ?? []) {
      const itemId = normItemId(item);
      if (!itemId) continue;

      out.push({
        itemId,
        name: cleanText((item as any)?.name ?? (item as any)?.itemName ?? ""),
        code: cleanText((item as any)?.code ?? (item as any)?.itemCode ?? ""),
        unit: cleanText((item as any)?.unit ?? ""),
        barcode: cleanText((item as any)?.barcode ?? ""),
      } as any);
    }
  }

  return out.filter((item: any) => item.name || item.code || item.unit || item.barcode);
}

function buildStandaloneMetaPatch(
  qty: QtyMap,
  metaById: Map<number, ItemDescriptorResponseDTO>
): StandaloneMetaMap {
  const out: StandaloneMetaMap = {};

  for (const [k, v] of Object.entries(qty ?? {})) {
    const itemId = Number(k);
    const q = Number(v ?? 0);

    if (!itemId || q <= 0) continue;

    const m: any = metaById.get(itemId);
    if (!m) continue;

    const name = cleanText(m?.name ?? "");
    const code = cleanText(m?.code ?? "");
    const unit = cleanText(m?.unit ?? "");
    const barcode = cleanText(m?.barcode ?? "");

    if (!name && !code && !unit && !barcode) continue;

    out[String(itemId)] = { itemId, name, code, unit, barcode };
  }

  return out;
}

export default function SessionEntryStandaloneItems() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);

  const tabBarHeight = useBottomTabBarHeight();
  const listBottomPad = tabBarHeight + 16;

  const sessionQ = useBookingSession(sessionId);
  const { session: authSession } = useCurrentUser();

  const documentDescriptorsQ = useQuery({
    queryKey: ["session-entry-items", "document-groups", "OTPREMNICA"],
    queryFn: ({ signal }) =>
      documentDirectoryService.listDocTypesByCode({ documentCode: "OTPREMNICA" }, signal),
    staleTime: 16 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const draft = useEntryDraft(sessionId, partnerId);

  const [tab, setTab] = useState<"results" | "added">("results");
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedDocumentByGroupId, setSelectedDocumentByGroupId] = useState<Record<string, number>>({});
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [qtyByDocumentId, setQtyByDocumentId] = useState<Record<string, QtyMap>>({});
  const [metaById, setMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());

  const [page, setPage] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const [items, setItems] = useState<ItemDescriptorResponseDTO[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadMoreErr, setLoadMoreErr] = useState<string | null>(null);

  const documentDescriptors = useMemo(
    () => ((documentDescriptorsQ.data ?? []) as DocumentDescriptorResponseDTO[])
      .filter((doc) => normDocumentId(doc) > 0)
      .sort(compareDocumentDescriptors),
    [documentDescriptorsQ.data]
  );

  const documentGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; docs: DocumentDescriptorResponseDTO[] }>();
    for (const doc of documentDescriptors) {
      const rawId = Number((doc as any)?.storageGroupId);
      const id = Number.isFinite(rawId) && rawId > 0 ? String(rawId) : `doc-${doc.documentId}`;
      const current = map.get(id) ?? {
        id,
        name: descriptorTitle(doc),
        docs: [],
      };
      current.docs.push(doc);
      map.set(id, current);
    }
    return Array.from(map.values())
      .map((group) => ({ ...group, docs: group.docs.slice().sort(compareDocumentDescriptors) }))
      .sort((a, b) => compareDocumentDescriptors(a.docs[0] ?? null, b.docs[0] ?? null));
  }, [documentDescriptors]);

  const selectedDescriptor = useMemo(() => {
    if (!selectedDocumentId) return null;
    return documentDescriptors.find((doc) => normDocumentId(doc) === selectedDocumentId) ?? null;
  }, [documentDescriptors, selectedDocumentId]);

  const selectedGroupId = useMemo(() => {
    const raw = Number((selectedDescriptor as any)?.storageGroupId);
    if (Number.isFinite(raw) && raw > 0) return String(raw);
    return selectedDescriptor?.documentId ? `doc-${selectedDescriptor.documentId}` : null;
  }, [selectedDescriptor]);

  const selectedGroup = useMemo(
    () => documentGroups.find((group) => group.id === selectedGroupId) ?? documentGroups[0] ?? null,
    [documentGroups, selectedGroupId]
  );

  const pickerDocuments = useMemo(
    () => selectedGroup?.docs ?? documentDescriptors,
    [selectedGroup, documentDescriptors]
  );

  const currentQty = useMemo(() => {
    if (!selectedDocumentId) return { ...(draft?.standaloneQty ?? {}) };
    return { ...(qtyByDocumentId[String(selectedDocumentId)] ?? {}) };
  }, [draft?.standaloneQty, qtyByDocumentId, selectedDocumentId]);

  const allQtyForMeta = useMemo(
    () => mergeQtyMapsForMeta(qtyByDocumentId, draft?.standaloneQty ?? {}),
    [draft?.standaloneQty, qtyByDocumentId]
  );

  const chooseDocumentForGroup = useCallback((group: { id: string; docs: DocumentDescriptorResponseDTO[] }) => {
    const rememberedDocumentId = Number(selectedDocumentByGroupId[group.id] ?? 0);
    if (
      rememberedDocumentId > 0 &&
      group.docs.some((doc) => normDocumentId(doc) === rememberedDocumentId)
    ) {
      return rememberedDocumentId;
    }

    const extraDocs = normalizeExtraDocs((draft as any)?.extraDocs ?? []);
    const docsWithPersistedItems = new Set(extraDocs.map((doc) => doc.documentId));

    const persistedDoc = group.docs.find((doc) => docsWithPersistedItems.has(normDocumentId(doc)));
    if (persistedDoc) return normDocumentId(persistedDoc);

    const localDoc = group.docs.find((doc) => Object.keys(qtyByDocumentId[String(normDocumentId(doc))] ?? {}).length > 0);
    if (localDoc) return normDocumentId(localDoc);

    const defaults = ((authSession as any)?.defaultWarehouseByStorageGroup ?? {}) as Record<string, number>;
    const preferredWarehouseId = Number(defaults[group.id] ?? 0);
    const preferredDoc = preferredWarehouseId
      ? group.docs.find((doc) => Number((doc as any)?.warehouseId ?? 0) === preferredWarehouseId)
      : null;

    return normDocumentId(preferredDoc ?? group.docs[0]) || null;
  }, [authSession, draft, qtyByDocumentId, selectedDocumentByGroupId]);

  useEffect(() => {
    if (!selectedDocumentId || !selectedGroupId) return;

    setSelectedDocumentByGroupId((prev) => {
      if (prev[selectedGroupId] === selectedDocumentId) return prev;
      return { ...prev, [selectedGroupId]: selectedDocumentId };
    });
  }, [selectedDocumentId, selectedGroupId]);

  useEffect(() => {
    if (selectedDocumentId || !documentDescriptors.length) return;

    const extraDocId = normalizeExtraDocs((draft as any)?.extraDocs ?? [])?.[0]?.documentId ?? 0;
    if (extraDocId) {
      setSelectedDocumentId(extraDocId);
      return;
    }

    const defaults = ((authSession as any)?.defaultWarehouseByStorageGroup ?? {}) as Record<string, number>;
    for (const group of documentGroups) {
      const preferredWarehouseId = Number(defaults[group.id] ?? 0);
      if (!preferredWarehouseId) continue;
      const preferredDoc = group.docs.find((doc) => Number((doc as any)?.warehouseId ?? 0) === preferredWarehouseId);
      if (preferredDoc) {
        setSelectedDocumentId(normDocumentId(preferredDoc));
        return;
      }
    }

    setSelectedDocumentId(normDocumentId(documentDescriptors[0]) || null);
  }, [selectedDocumentId, documentDescriptors, documentGroups, draft, authSession]);

  useEffect(() => {
    setQtyByDocumentId(qtyByDocumentFromExtraDocs((draft as any)?.extraDocs ?? []));
  }, [(draft as any)?.extraDocs]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    const seed = seedMetaMapFromStandaloneMeta((draft as any)?.standaloneMetaById);
    const extraSeed = seedMetaMapFromExtraDocs((draft as any)?.extraDocs ?? []);
    const all = [...seed, ...extraSeed];
    if (!all.length) return;

    setMetaById((prev) => mergeItemMeta(prev, all));
  }, [draft?.standaloneMetaById, (draft as any)?.extraDocs]);

  const missingMetaKey = useMemo(() => {
    return Object.keys(currentQty ?? {})
      .map((id) => Number(id))
      .filter((id) => id > 0 && !cleanText((metaById.get(id) as any)?.name ?? ""))
      .sort((a, b) => a - b)
      .join(",");
  }, [currentQty, metaById]);

  useEffect(() => {
    const targetWarehouseId = Number((selectedDescriptor as any)?.warehouseId ?? 0);
    if (!targetWarehouseId || !missingMetaKey) return;

    let alive = true;
    const ids = missingMetaKey
      .split(",")
      .map((x) => Number(x))
      .filter((x) => x > 0);

    (async () => {
      const found: ItemDescriptorResponseDTO[] = [];

      for (const itemId of ids) {
        try {
          const res = await itemDirectoryService.pageItems({
            warehouseId: targetWarehouseId,
            page: 0,
            size: 25,
            q: String(itemId),
          });

          const exact = ((res.items ?? []) as ItemDescriptorResponseDTO[])
            .find((item) => normItemId(item) === itemId);
          if (exact) found.push(exact);
        } catch {
          // Keep the editor usable; unresolved rows still show their item id.
        }
      }

      if (!alive || !found.length) return;
      setMetaById((prev) => mergeItemMeta(prev, found));
    })();

    return () => {
      alive = false;
    };
  }, [missingMetaKey, selectedDescriptor]);

  useEffect(() => {
    setPage(0);
    setItems([]);
    setTotal(0);
    setLoadErr(null);
    setLoadMoreErr(null);
    setReloadTick((x) => x + 1);
  }, [selectedDocumentId, debouncedQ]);

  useEffect(() => {
    let alive = true;
    const targetWarehouseId = Number((selectedDescriptor as any)?.warehouseId ?? 0);
    if (!targetWarehouseId) return;

    (async () => {
      const isFirst = page === 0;

      try {
        if (isFirst) setLoading(true);
        else setLoadingMore(true);

        if (isFirst) setLoadErr(null);
        setLoadMoreErr(null);

        const res = await itemDirectoryService.pageItems({
          warehouseId: targetWarehouseId,
          page,
          size: PAGE_SIZE,
          q: debouncedQ || undefined,
        });

        if (!alive) return;

        const nextItems = (res.items ?? []) as ItemDescriptorResponseDTO[];
        setTotal(Number(res.total ?? 0));

        setItems((prev) => {
          if (isFirst) return nextItems;

          const seen = new Set(prev.map((x: any) => String(normItemId(x))));
          const merged = [...prev];

          for (const it of nextItems) {
            const id = String(normItemId(it));
            if (!id || id === "0" || seen.has(id)) continue;
            seen.add(id);
            merged.push(it);
          }

          return merged;
        });

        if (nextItems.length) {
          setMetaById((prev) => mergeItemMeta(prev, nextItems));
        }
      } catch (e) {
        if (!alive) return;

        const msg = toUserMessage(e, "Greška pri dohvaćanju artikala.");
        if (page === 0) setLoadErr(msg);
        else setLoadMoreErr(msg);
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedDescriptor, debouncedQ, page, reloadTick]);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);
  const addedItems = useMemo(() => qtyToItems(currentQty), [currentQty]);

  const topError = useMemo(() => {
    if (sessionQ.error) return toUserMessage(sessionQ.error, "Greška pri učitavanju sesije.");
    if (documentDescriptorsQ.error) return toUserMessage(documentDescriptorsQ.error, "Greška pri učitavanju grupa dokumenta.");
    if (loadErr) return loadErr;
    return null;
  }, [sessionQ.error, documentDescriptorsQ.error, loadErr]);

  const refreshNow = useCallback(() => {
    setLoadErr(null);
    setLoadMoreErr(null);
    setPage(0);
    setReloadTick((x) => x + 1);
    sessionQ.refetch?.();
    documentDescriptorsQ.refetch?.();
  }, [sessionQ, documentDescriptorsQ]);

  const onEndReached = useCallback(() => {
    if (!hasMore) return;
    if (loading || loadingMore) return;
    setPage((p) => p + 1);
  }, [hasMore, loading, loadingMore]);

  const handleAddFromResults = useCallback((item: ItemDescriptorResponseDTO) => {
    const id = normItemId(item);
    if (!id || !selectedDocumentId) return;

    setMetaById((prev) => mergeItemMeta(prev, [item]));
    setQtyByDocumentId((prev) => ({
      ...prev,
      [String(selectedDocumentId)]: upsertQty(prev[String(selectedDocumentId)] ?? {}, id, 1),
    }));
    setTab("added");
  }, [selectedDocumentId]);

  const handleDecrease = useCallback((itemId: number) => {
    if (!selectedDocumentId) return;
    setQtyByDocumentId((prev) => ({
      ...prev,
      [String(selectedDocumentId)]: upsertQty(prev[String(selectedDocumentId)] ?? {}, itemId, -1),
    }));
  }, [selectedDocumentId]);

  const handleIncrease = useCallback((itemId: number) => {
    if (!selectedDocumentId) return;
    setQtyByDocumentId((prev) => ({
      ...prev,
      [String(selectedDocumentId)]: upsertQty(prev[String(selectedDocumentId)] ?? {}, itemId, +1),
    }));
  }, [selectedDocumentId]);

  const handleRemove = useCallback((itemId: number) => {
    if (!selectedDocumentId) return;
    setQtyByDocumentId((prev) => {
      const cur = prev[String(selectedDocumentId)] ?? {};
      const k = String(itemId);
      const { [k]: _, ...rest } = cur;
      return { ...prev, [String(selectedDocumentId)]: rest };
    });
  }, [selectedDocumentId]);

  const apply = useCallback(() => {
    const prevMeta = ((draft as any)?.standaloneMetaById ?? {}) as StandaloneMetaMap;
    const patchMeta = buildStandaloneMetaPatch(allQtyForMeta, metaById);
    const nextMeta: StandaloneMetaMap = { ...prevMeta, ...patchMeta };
    const currentDocs = normalizeExtraDocs((draft as any)?.extraDocs ?? []);
    const docIds = new Set<number>(currentDocs.map((doc) => doc.documentId));
    for (const key of Object.keys(qtyByDocumentId)) {
      const docId = Number(key);
      if (docId > 0) docIds.add(docId);
    }

    const nextExtraDocs = Array.from(docIds)
      .map((documentId) => {
        const existingQty = qtyForDocument(currentDocs, documentId);
        const qty = qtyByDocumentId[String(documentId)] ?? existingQty;
        return {
          documentId,
          items: qtyToItemsWithMeta(qty, metaById),
        };
      })
      .filter((doc) => doc.documentId > 0 && doc.items.length > 0)
      .sort((a, b) => a.documentId - b.documentId);

    patchDraft(sessionId, partnerId, {
      standaloneQty: selectedDocumentId ? {} : currentQty,
      standaloneMetaById: nextMeta,
      extraDocs: nextExtraDocs as any,
    });

    router.back();
  }, [allQtyForMeta, currentQty, sessionId, partnerId, qtyByDocumentId, metaById, draft, selectedDocumentId]);

  if (!draft) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <NavigationHeader
          title="Stavke"
          fallbackHref={{
            pathname: "/(tabs)/sessions/[id]" as const,
            params: { id: String(sessionId), partnerId: String(partnerId) },
          }}
        />
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Učitavam…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader
        title="Dodatne stavke"
        fallbackHref={{
          pathname: "/(tabs)/sessions/[id]/entry" as const,
          params: { id: String(sessionId), partnerId: String(partnerId) },
        }}
      />

      <View style={s.wrap}>
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Pokušaj ponovno"
            onAction={refreshNow}
            titleLines={1}
            messageLines={3}
          />
        )}

        {documentDescriptorsQ.isLoading && !documentDescriptors.length ? (
          <View style={s.centerInline}>
            <ActivityIndicator />
            <Text style={s.muted}>Učitavam grupe dokumenata…</Text>
          </View>
        ) : !selectedDescriptor ? (
          <ErrorCard
            title="Odaberi grupu dokumenta"
            message="Za dodatne stavke prvo odaberi vrstu otpremnice. Artikli se prikazuju prema skladištu odabrane grupe."
            actionText="Odaberi"
            onAction={() => setDocPickerOpen(true)}
            titleLines={1}
            messageLines={4}
          />
        ) : (
          <>
            {documentGroups.length > 1 ? (
              <View style={s.groupTabs}>
                {documentGroups.map((group) => {
                  const active = selectedGroupId === group.id;
                  const tone = documentToneFromText(group.name);
                  return (
                    <Pressable
                      key={group.id}
                      style={[
                        s.groupTabBtn,
                        tone === "social" && s.groupTabBtnSocial,
                        tone === "donation" && s.groupTabBtnDonation,
                        active && s.groupTabBtnActive,
                        active && tone === "social" && s.groupTabBtnActiveSocial,
                      active && tone === "donation" && s.groupTabBtnActiveDonation,
                      ]}
                      onPress={() => {
                        setSelectedDocumentId(chooseDocumentForGroup(group));
                      }}
                    >
                      <Text style={[s.groupTabText, active && s.groupTabTextActive]} numberOfLines={2}>
                        {group.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Pressable
              style={[
                s.docContext,
                documentTone(selectedDescriptor) === "social" && s.docContextSocial,
                documentTone(selectedDescriptor) === "donation" && s.docContextDonation,
              ]}
              onPress={() => setDocPickerOpen(true)}
            >
              <View
                style={[
                  s.docIcon,
                  documentTone(selectedDescriptor) === "social" && s.docIconSocial,
                  documentTone(selectedDescriptor) === "donation" && s.docIconDonation,
                ]}
              >
                <FontAwesome name="file-text-o" size={18} color={Colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.docLabel} numberOfLines={2}>
                  {descriptorTitle(selectedDescriptor)}
                </Text>
                <Text style={s.docSub} numberOfLines={2}>
                  {descriptorSubtitle(selectedDescriptor)}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={18} color={Colors.sub} />
            </Pressable>

            <View style={s.tabs}>
              <Pressable
                style={[s.tabBtn, tab === "results" && s.tabBtnActive]}
                onPress={() => setTab("results")}
              >
                <Text style={[s.tabText, tab === "results" && s.tabTextActive]}>Rezultati</Text>
              </Pressable>

              <Pressable
                style={[s.tabBtn, tab === "added" && s.tabBtnActive]}
                onPress={() => setTab("added")}
              >
                <Text style={[s.tabText, tab === "added" && s.tabTextActive]}>
                  Dodano ({addedItems.length})
                </Text>
              </Pressable>
            </View>

            {tab === "results" ? (
              <>
                <View style={s.searchWrap}>
                  <FontAwesome name="search" size={14} color={Colors.sub} />
                  <TextInput
                    value={searchQ}
                    onChangeText={setSearchQ}
                    placeholder="Pretraži artikle (naziv, šifra)…"
                    placeholderTextColor={PLACEHOLDER}
                    style={s.search}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {!!searchQ && (
                    <Pressable onPress={() => setSearchQ("")} hitSlop={8}>
                      <FontAwesome name="times-circle" size={16} color={Colors.sub} />
                    </Pressable>
                  )}
                </View>

                {loading && items.length === 0 ? (
                  <View style={s.centerInline}>
                    <ActivityIndicator />
                    <Text style={s.muted}>Učitavam…</Text>
                  </View>
                ) : (
                  <FlatList
                    style={s.list}
                    data={items}
                    keyExtractor={(it: any) => String(normItemId(it))}
                    keyboardShouldPersistTaps="handled"
                    refreshing={loading && page === 0}
                    onRefresh={refreshNow}
                    onEndReachedThreshold={0.35}
                    onEndReached={onEndReached}
                    contentContainerStyle={[s.listContent, { paddingBottom: listBottomPad }]}
                    scrollIndicatorInsets={{ bottom: listBottomPad }}
                    ListEmptyComponent={<Text style={s.helper}>Nema rezultata.</Text>}
                    ListFooterComponent={
                      loadingMore || loadMoreErr || (!hasMore && items.length > 0) ? (
                        <View style={s.footerWrap}>
                          {loadingMore ? <ActivityIndicator size="small" /> : null}

                          {loadMoreErr ? (
                            <Pressable
                              style={s.footerRetryBtn}
                              onPress={() => {
                                if (loading || loadingMore) return;
                                setLoadMoreErr(null);
                                setReloadTick((x) => x + 1);
                              }}
                            >
                              <Text style={s.footerRetryText}>
                                {loadMoreErr} • Dodirni za pokušaj ponovno
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null
                    }
                    renderItem={({ item }: { item: ItemDescriptorResponseDTO }) => {
                      const id = normItemId(item);
                      const display = formatItemDisplay(id, metaById, item);

                      return (
                        <Pressable
                          style={s.resultRow}
                          onPress={() => handleAddFromResults(item)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNameStrong} numberOfLines={2}>
                              {display.name}
                            </Text>
                            {!!display.meta && (
                              <Text style={s.itemMeta} numberOfLines={1}>
                                {display.meta}
                              </Text>
                            )}
                          </View>

                          <View style={s.addBtn}>
                            <Text style={s.addBtnText}>+1</Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                )}
              </>
            ) : (
              <FlatList
                style={s.list}
                data={addedItems}
                keyExtractor={(x) => String((x as any).itemId)}
                keyboardShouldPersistTaps="handled"
                refreshing={loading && page === 0}
                onRefresh={refreshNow}
                contentContainerStyle={[s.listContent, { paddingBottom: listBottomPad }]}
                scrollIndicatorInsets={{ bottom: listBottomPad }}
                ListEmptyComponent={
                  <Text style={s.helper}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>
                }
                renderItem={({ item }) => {
                  const itemId = Number((item as any)?.itemId);
                  const quantity = Number((item as any)?.quantity ?? 0);
                  const display = formatItemDisplay(itemId, metaById);

                  return (
                    <View
                      style={[
                        s.addedRow,
                        documentTone(selectedDescriptor) === "social" && s.addedRowSocial,
                        documentTone(selectedDescriptor) === "donation" && s.addedRowDonation,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemNameStrong} numberOfLines={2}>
                          {display.name}
                        </Text>
                        {!!display.meta && (
                          <Text style={s.itemMeta} numberOfLines={1}>
                            {display.meta}
                          </Text>
                        )}
                      </View>

                      <View style={s.qtyBox}>
                        <Pressable
                          style={s.qtyBtn}
                          onPress={() => handleDecrease(itemId)}
                        >
                          <Text style={s.qtyBtnText}>−</Text>
                        </Pressable>

                        <View style={s.qtyPill}>
                          <Text style={s.qtyPillText}>{quantity}</Text>
                        </View>

                        <Pressable
                          style={s.qtyBtn}
                          onPress={() => handleIncrease(itemId)}
                        >
                          <Text style={s.qtyBtnText}>+</Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={s.smallDangerBtn}
                        onPress={() => handleRemove(itemId)}
                      >
                        <Text style={s.smallDangerText}>X</Text>
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}

            <Pressable style={s.primary} onPress={apply}>
              <Text style={s.primaryText}>Primijeni</Text>
            </Pressable>
          </>
        )}

        <SearchPickerSheet<DocumentDescriptorResponseDTO>
          visible={docPickerOpen}
          title="Odaberi grupu dokumenta"
          onClose={() => setDocPickerOpen(false)}
          keyOf={(doc) => String(doc.documentId)}
          queryKeyBase={["session-entry-items", "document-picker", selectedGroupId ?? "none"] as const}
          queryPage={async ({ page, size, q }) => {
            const all = filterDocumentDescriptors(pickerDocuments, q)
              .slice()
              .sort(compareDocumentDescriptors);
            const start = page * size;
            return {
              items: all.slice(start, start + size),
              page,
              size,
              total: all.length,
            };
          }}
          renderRow={(doc, close) => (
            <Pressable
              style={[
                s.pickRow,
                documentTone(doc) === "social" && s.pickRowSocial,
                documentTone(doc) === "donation" && s.pickRowDonation,
              ]}
              onPress={() => {
                const nextDocId = normDocumentId(doc);
                if (!nextDocId) return;
                setSelectedDocumentId(nextDocId);
                setTab("results");
                close();
              }}
            >
              <View style={s.pickTextBlock}>
                <Text style={s.pickTitle} numberOfLines={2}>{descriptorTitle(doc)}</Text>
                <Text style={s.pickSub} numberOfLines={2}>{descriptorSubtitle(doc)}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    padding: 14,
    gap: 12,
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
  },

  list: { flex: 1, minHeight: 0 },
  listContent: { gap: 10 },

  center: { padding: 16, alignItems: "center", gap: 10 },
  centerInline: { paddingVertical: 14, alignItems: "center", gap: 10 },

  muted: { color: Colors.sub, fontWeight: "800" },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  groupTabs: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  groupTabBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  groupTabBtnSocial: {
    borderColor: "rgba(14,165,233,0.34)",
    backgroundColor: "rgba(14,165,233,0.08)",
  },
  groupTabBtnDonation: {
    borderColor: "rgba(34,197,94,0.34)",
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  groupTabBtnActive: {
    borderColor: "rgba(249,115,22,0.42)",
    backgroundColor: "rgba(249,115,22,0.14)",
  },
  groupTabBtnActiveSocial: {
    borderColor: "rgba(14,165,233,0.58)",
    backgroundColor: "rgba(14,165,233,0.18)",
  },
  groupTabBtnActiveDonation: {
    borderColor: "rgba(34,197,94,0.58)",
    backgroundColor: "rgba(34,197,94,0.18)",
  },
  groupTabText: { color: Colors.sub, fontWeight: "900", fontSize: 12, textAlign: "center" },
  groupTabTextActive: { color: Colors.text },

  docContext: {
    width: "100%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.28)",
    backgroundColor: "rgba(255,247,237,0.95)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docContextSocial: {
    borderColor: "rgba(14,165,233,0.36)",
    backgroundColor: "rgba(239,246,255,0.96)",
  },
  docContextDonation: {
    borderColor: "rgba(34,197,94,0.36)",
    backgroundColor: "rgba(240,253,244,0.96)",
  },
  docIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  docIconSocial: {
    backgroundColor: "rgba(14,165,233,0.14)",
  },
  docIconDonation: {
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  docLabel: { color: Colors.text, fontWeight: "900", fontSize: 15 },
  docSub: { color: Colors.sub, fontWeight: "800", fontSize: 12, marginTop: 2 },

  pickRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    gap: 4,
    overflow: "hidden",
  },
  pickRowSocial: {
    borderColor: "rgba(14,165,233,0.30)",
    backgroundColor: "rgba(239,246,255,0.78)",
  },
  pickRowDonation: {
    borderColor: "rgba(34,197,94,0.30)",
    backgroundColor: "rgba(240,253,244,0.82)",
  },
  pickTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  pickTitle: { color: Colors.text, fontWeight: "900", fontSize: 15 },
  pickSub: { color: Colors.sub, fontWeight: "800", fontSize: 12 },

  primary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  btnWide: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  btnText: { fontWeight: "900", color: Colors.text },

  tabs: { width: "100%", flexDirection: "row", gap: 10 },
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

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

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

  addedRow: {
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
  addedRowSocial: {
    borderColor: "rgba(14,165,233,0.46)",
    backgroundColor: "rgba(224,242,254,0.92)",
  },
  addedRowDonation: {
    borderColor: "rgba(34,197,94,0.46)",
    backgroundColor: "rgba(220,252,231,0.92)",
  },

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

  qtyPill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyPillText: { fontWeight: "900", color: Colors.text },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallDangerText: { fontWeight: "900", color: Colors.dangerText },

  footerWrap: { paddingVertical: 12, alignItems: "center", gap: 8 },
  footerRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  footerRetryText: { color: Colors.text, fontWeight: "700", textAlign: "center" },
});
