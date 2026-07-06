import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";

import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import ValidateImpactModal from "@/components/ValidateImpactModal";
import ValidateManyModal, { toValidateRow, type ValidateRow } from "@/components/ValidateManyModal";
import { TemplateDocItemsEditorModal } from "@/components/TemplateDocItemsEditorModal";
import InfoResultPopup from "@/components/InfoResultPopup";

import type {
  DraftMode,
  DispatchBulkValidationRequestDTO,
  DispatchRequestValidationDTO,
  DocumentDescriptorResponseDTO,
  ItemDescriptorResponseDTO,
  PartnerResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookExtraDocDTO,
  TemplateBookItemDTO,
  TemplateDocResponseDTO,
  TemplateItemResponseDTO,
  TemplateItemUpsertRequestDTO,
} from "@/src/models/generated";

import { partnerService } from "../../../../../src/api/services/partnerService";
import { useCurrentUser } from "../../../../../src/api/hooks/common/useCurrentUser";
import { toLocalDateString } from "@/src/utils/dateIso";
import {
  useBookTemplateOne,
  useTemplateDetail,
  useValidateTemplateMany,
} from "../../../../../src/api/hooks/templates/useDispatchTemplates";
import { documentDirectoryService } from "../../../../../src/api/services/documentDirectoryService";
import { itemDirectoryService } from "../../../../../src/api/services/itemDirectoryService";

import { MAX_W, s } from "../../../../../src/styles/TemplateDispatch.styles";
import { toUserMessage } from "@/src/api/apiClient";

type PartnerNoteMap = Record<string, string>;

type ExtraDocDraft = {
  documentId: number;
  items: TemplateBookItemDTO[];
};

type TemplateDispatchDraft = {
  selectedPartners: PartnerResponseDTO[];
  partnerNoteById: PartnerNoteMap;
  draftMode: DraftMode;
  extraDocs: ExtraDocDraft[];
  extraItemsDocumentId: number | null;
};

const templateDispatchDrafts = new Map<number, TemplateDispatchDraft>();

type ResultPopupState = {
  visible: boolean;
  kind: "success" | "error" | "info";
  title: string;
  message: string;
  linkHeaderId?: number | null;
};

function mergeItemMeta(
  prev: Map<number, ItemDescriptorResponseDTO>,
  items: ItemDescriptorResponseDTO[] | null | undefined
) {
  const next = new Map(prev);

  for (const item of items ?? []) {
    const itemId = Number((item as any)?.itemId);
    if (!itemId) continue;
    next.set(itemId, item);
  }

  return next;
}

function collectItemMetaFromTemplate(
  templateDocs: TemplateDocResponseDTO[] | null | undefined
): ItemDescriptorResponseDTO[] {
  const out: ItemDescriptorResponseDTO[] = [];
  const seen = new Set<number>();

  for (const doc of templateDocs ?? []) {
    for (const row of (((doc as any)?.items ?? []) as TemplateItemResponseDTO[])) {
      const itemId = Number((row as any)?.itemId);
      if (!itemId || seen.has(itemId)) continue;

      const name = String((row as any)?.itemName ?? "").trim();
      const code = String((row as any)?.itemCode ?? "").trim();
      const unit = String((row as any)?.unit ?? "").trim();
      const barcode = String((row as any)?.barcode ?? "").trim();

      if (!name && !code && !unit && !barcode) continue;

      out.push({ itemId, name, code, unit, barcode } as ItemDescriptorResponseDTO);
      seen.add(itemId);
    }
  }

  return out;
}

function formatItemDisplay(
  itemId: number,
  metaById: Map<number, ItemDescriptorResponseDTO>,
  row?: Partial<TemplateItemResponseDTO> | null
) {
  const rowName = String((row as any)?.itemName ?? "").trim();
  const rowCode = String((row as any)?.itemCode ?? "").trim();
  const rowUnit = String((row as any)?.unit ?? "").trim();
  const rowBarcode = String((row as any)?.barcode ?? "").trim();

  if (rowName || rowCode || rowUnit || rowBarcode) {
    const subtitle = [
      rowCode ? `Šifra: ${rowCode}` : null,
      rowUnit ? `JMJ: ${rowUnit}` : null,
      rowBarcode ? `BC: ${rowBarcode}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    return {
      name: rowName || "Učitavam artikl…",
      meta: subtitle,
    };
  }

  const meta = metaById.get(itemId);
  const name = String((meta as any)?.name ?? "").trim();
  const code = String((meta as any)?.code ?? "").trim();
  const unit = String((meta as any)?.unit ?? "").trim();
  const barcode = String((meta as any)?.barcode ?? "").trim();

  const subtitle = [
    code ? `Šifra: ${code}` : null,
    unit ? `JMJ: ${unit}` : null,
    barcode ? `BC: ${barcode}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    name: name || "Učitavam artikl…",
    meta: subtitle,
  };
}

function buildValidatePayload(args: {
  warehouseId: number;
  partnerId: number;
  draftMode: DraftMode;
  templateDocs: TemplateDocResponseDTO[];
  docPatches: TemplateBookDocPatchDTO[];
  extraDocs: ExtraDocDraft[];
  note?: string | null;
}): DispatchRequestValidationDTO {
  const { warehouseId, partnerId, draftMode, templateDocs, docPatches, extraDocs, note } = args;

  const totalByItemId: Record<string, number> = {};

  const add = (itemIdRaw: unknown, qtyRaw: unknown) => {
    const itemId = Number(itemIdRaw);
    const quantity = Number(qtyRaw ?? 0);
    if (!itemId || !Number.isFinite(quantity) || quantity === 0) return;

    const key = String(itemId);
    totalByItemId[key] = Number(totalByItemId[key] ?? 0) + quantity;
  };

  for (const doc of templateDocs ?? []) {
    for (const row of (doc?.items ?? []) as any[]) {
      add(row?.itemId, row?.quantity);
    }
  }

  for (const patch of docPatches ?? []) {
    for (const row of (((patch as any)?.addItems ?? []) as any[])) {
      add(row?.itemId, row?.quantity);
    }
  }

  for (const doc of extraDocs ?? []) {
    for (const row of doc.items ?? []) {
      add((row as any)?.itemId, (row as any)?.quantity);
    }
  }

  const items = Object.entries(totalByItemId)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => a.itemId - b.itemId);

  const documentIds = Array.from(
    new Set(
      (templateDocs ?? [])
        .map((doc) => Number((doc as any)?.documentId))
        .concat((extraDocs ?? []).map((doc) => Number(doc.documentId)))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  return {
    warehouseId: Number(warehouseId),
    documentId: documentIds.length === 1 ? documentIds[0] : undefined,
    partnerId: Number(partnerId),
    documentDate: undefined as any,
    draft: draftMode === "DRAFT",
    note: note ?? undefined,
    items: items as any,
  } as any;
}

function partnerDisplayName(partner: PartnerResponseDTO) {
  const name = String((partner as any)?.name ?? "").trim();
  const number = String((partner as any)?.partnerNumber ?? "").trim();
  if (name && number) return `${name} #${number}`;
  if (name) return name;
  return number ? `Partner #${number}` : "Partner";
}

function normDocumentId(x: any): number {
  const n = Number(x?.documentId ?? x?.document_id ?? x?.id ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function documentGroupTitle(doc: DocumentDescriptorResponseDTO | null | undefined, documentId?: number | null) {
  const group = String((doc as any)?.storageGroupName ?? "").trim();
  const display = String((doc as any)?.displayName ?? "").trim();
  const code = String((doc as any)?.documentCode ?? "").trim();
  return group || display || code || (documentId ? `Dokument #${documentId}` : "Grupa dokumenta");
}

function documentGroupSubtitle(doc: DocumentDescriptorResponseDTO | null | undefined) {
  if (!doc) return "Artikli se učitavaju prema odabranoj grupi.";
  return [
    String((doc as any)?.displayName ?? "").trim(),
    String((doc as any)?.documentCode ?? "").trim(),
    doc.documentId ? `Dokument #${doc.documentId}` : null,
    doc.warehouseId ? `Skladište #${doc.warehouseId}` : null,
  ].filter(Boolean).join(" • ");
}

function documentGroupRank(doc: DocumentDescriptorResponseDTO | null | undefined): number {
  const text = `${(doc as any)?.storageGroupName ?? ""} ${(doc as any)?.displayName ?? ""}`.toLowerCase();
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
    `${String((doc as any)?.storageGroupName ?? "").trim()} ${String((doc as any)?.displayName ?? "").trim()}`
  );
}

function compareDocumentDescriptors(
  a: DocumentDescriptorResponseDTO | null | undefined,
  b: DocumentDescriptorResponseDTO | null | undefined
): number {
  const rank = documentGroupRank(a) - documentGroupRank(b);
  if (rank !== 0) return rank;

  const name = documentGroupTitle(a, normDocumentId(a)).localeCompare(
    documentGroupTitle(b, normDocumentId(b)),
    "hr",
    { sensitivity: "base" }
  );
  if (name !== 0) return name;

  const aw = Number((a as any)?.warehouseId ?? 0);
  const bw = Number((b as any)?.warehouseId ?? 0);
  if (aw !== bw) return aw - bw;

  return normDocumentId(a) - normDocumentId(b);
}

function filterDocumentDescriptors(
  docs: DocumentDescriptorResponseDTO[],
  q?: string | null
) {
  const query = String(q ?? "").trim().toLowerCase();
  if (!query) return docs;

  return docs.filter((doc) => {
    const haystack = [
      documentGroupTitle(doc, normDocumentId(doc)),
      documentGroupSubtitle(doc),
      String((doc as any)?.documentId ?? ""),
      String((doc as any)?.warehouseId ?? ""),
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function sortExtraDocs(
  extraDocs: ExtraDocDraft[],
  descriptors: Map<number, DocumentDescriptorResponseDTO>
): ExtraDocDraft[] {
  return extraDocs.slice().sort((a, b) => {
    const ad = descriptors.get(a.documentId) ?? null;
    const bd = descriptors.get(b.documentId) ?? null;
    const byDoc = compareDocumentDescriptors(ad, bd);
    if (byDoc !== 0) return byDoc;
    return a.documentId - b.documentId;
  });
}

function itemsForDocument(extraDocs: ExtraDocDraft[], documentId: number | null): TemplateBookItemDTO[] {
  if (!documentId) return [];
  return extraDocs.find((doc) => doc.documentId === documentId)?.items ?? [];
}

function toExtraDocsPayload(extraDocs: ExtraDocDraft[], draft: boolean): TemplateBookExtraDocDTO[] {
  return extraDocs
    .map((doc) => ({
      documentId: Number(doc.documentId),
      draft,
      note: "",
      items: (doc.items ?? [])
        .map((row) => ({
          itemId: Number((row as any)?.itemId),
          quantity: Number((row as any)?.quantity ?? 0),
        }))
        .filter((row) => row.itemId > 0 && Number.isFinite(row.quantity) && row.quantity > 0),
    }))
    .filter((doc) => doc.documentId > 0 && doc.items.length > 0) as any;
}

function upsertExtraDocItems(
  prev: ExtraDocDraft[],
  documentId: number,
  items: TemplateBookItemDTO[]
): ExtraDocDraft[] {
  const cleaned = (items ?? [])
    .map((row) => ({
      itemId: Number((row as any)?.itemId),
      quantity: Number((row as any)?.quantity ?? 0),
      name: String((row as any)?.name ?? (row as any)?.itemName ?? "").trim(),
      itemName: String((row as any)?.itemName ?? (row as any)?.name ?? "").trim(),
      code: String((row as any)?.code ?? (row as any)?.itemCode ?? "").trim(),
      itemCode: String((row as any)?.itemCode ?? (row as any)?.code ?? "").trim(),
      unit: String((row as any)?.unit ?? "").trim(),
      barcode: String((row as any)?.barcode ?? "").trim(),
    }))
    .filter((row) => row.itemId > 0 && Number.isFinite(row.quantity) && row.quantity > 0) as TemplateBookItemDTO[];

  const without = prev.filter((doc) => doc.documentId !== documentId);
  if (!cleaned.length) return without;
  return [...without, { documentId, items: cleaned }];
}

function preferredDocumentForGroup(
  group: { id: string; docs: DocumentDescriptorResponseDTO[] },
  defaults: Record<string, number> | null | undefined
): DocumentDescriptorResponseDTO | null {
  const preferredWarehouseId = Number(defaults?.[group.id] ?? 0);
  if (preferredWarehouseId > 0) {
    const preferred = group.docs.find((doc) => Number((doc as any)?.warehouseId ?? 0) === preferredWarehouseId);
    if (preferred) return preferred;
  }
  return group.docs[0] ?? null;
}

function buildBulkValidatePayload(args: {
  warehouseId: number;
  selectedPartners: PartnerResponseDTO[];
  draftMode: DraftMode;
  templateDocs: TemplateDocResponseDTO[];
  docPatches: TemplateBookDocPatchDTO[];
  extraDocs: ExtraDocDraft[];
  partnerNoteById: PartnerNoteMap;
}) {
  const {
    warehouseId,
    selectedPartners,
    draftMode,
    templateDocs,
    docPatches,
    extraDocs,
    partnerNoteById,
  } = args;

  const partnerNameById: Record<string, string> = {};

  const items: DispatchBulkValidationRequestDTO["items"] = selectedPartners
    .map((partner) => {
      const partnerId = Number((partner as any)?.id);
      if (!partnerId) return null;

      partnerNameById[String(partnerId)] = partnerDisplayName(partner);

      return {
        partnerId,
        request: buildValidatePayload({
          warehouseId,
          partnerId,
          draftMode,
          templateDocs,
          docPatches,
          extraDocs,
          note: partnerNoteById[String(partnerId)] ?? null,
        }),
      };
    })
    .filter(Boolean) as DispatchBulkValidationRequestDTO["items"];

  return { request: { items }, partnerNameById };
}

function asFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractFirstCreatedHeaderId(response: any): number | null {
  const directCandidates = [
    response?.headerId,
    response?.createdHeaderId,
    response?.dispatchHeaderId,
    response?.documentHeaderId,
    response?.data?.headerId,
    response?.data?.createdHeaderId,
    response?.result?.headerId,
    response?.result?.createdHeaderId,
  ];

  for (const c of directCandidates) {
    const n = asFiniteNumber(c);
    if (n) return n;
  }

  const arrays = [
    response?.headers,
    response?.results,
    response?.items,
    response?.data,
    response?.created,
    response?.documents,
  ];

  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;

    for (const row of arr) {
      const nestedCandidates = [
        row?.headerId,
        row?.createdHeaderId,
        row?.dispatchHeaderId,
        row?.documentHeaderId,
        row?.result?.headerId,
        row?.data?.headerId,
      ];

      for (const c of nestedCandidates) {
        const n = asFiniteNumber(c);
        if (n) return n;
      }
    }
  }

  return null;
}

export default function TemplateDispatchScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const templateId = Number(params.id);

  const { session } = useCurrentUser();

  const templateQuery = useTemplateDetail(templateId, { includeItemMeta: true });
  const template = templateQuery.data;
  const templateDocs: TemplateDocResponseDTO[] = (template?.documents ?? []) as any;

  const bookOneMutation = useBookTemplateOne();
  const validateTemplateMutation = useValidateTemplateMany();

  const documentDescriptorsQ = useQuery({
    queryKey: ["template-dispatch", "document-groups", "OTPREMNICA"],
    queryFn: ({ signal }) =>
      documentDirectoryService.listDocTypesByCode({ documentCode: "OTPREMNICA" }, signal),
    staleTime: 16 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  const rawTopError =
    screenError ||
    templateQuery.errorMessage ||
    (bookOneMutation.error ? String(bookOneMutation.error?.message ?? "Greška pri kreiranju.") : null);

  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  const closeTopError = () => {
    setScreenError(null);
    setDismissedTopError(rawTopError ?? null);
    bookOneMutation.reset();
  };

  const refreshing = templateQuery.isFetching || documentDescriptorsQ.isFetching;
  const onRefresh = () => {
    setScreenError(null);
    setDismissedTopError(null);
    void Promise.allSettled([
      Promise.resolve(templateQuery.refetch()),
      Promise.resolve(documentDescriptorsQ.refetch()),
    ]);
  };

  const bookingBusy = bookOneMutation.isPending;

  const [isPartnerPickerOpen, setIsPartnerPickerOpen] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<PartnerResponseDTO[]>([]);

  const selectedPartnerIds = useMemo(
    () => new Set(selectedPartners.map((p) => Number((p as any)?.id))),
    [selectedPartners]
  );

  const togglePartnerSelection = (partner: PartnerResponseDTO) => {
    const partnerId = Number((partner as any)?.id);

    setSelectedPartners((prev) => {
      const exists = prev.some((p) => Number((p as any)?.id) === partnerId);
      return exists
        ? prev.filter((p) => Number((p as any)?.id) !== partnerId)
        : [...prev, partner];
    });
  };

  const [partnerNoteById, setPartnerNoteById] = useState<PartnerNoteMap>({});
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [notePartner, setNotePartner] = useState<PartnerResponseDTO | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    const activeIds = new Set(selectedPartners.map((p) => String(Number((p as any)?.id))));

    setPartnerNoteById((prev) => {
      const next: PartnerNoteMap = {};
      for (const [k, v] of Object.entries(prev)) {
        if (activeIds.has(k)) next[k] = v;
      }
      return next;
    });
  }, [selectedPartners]);

  const openPartnerNote = (partner: PartnerResponseDTO) => {
    const partnerId = String(Number((partner as any)?.id));
    setNotePartner(partner);
    setNoteDraft(partnerNoteById[partnerId] ?? "");
    setIsNoteSheetOpen(true);
  };

  const savePartnerNote = () => {
    if (!notePartner) return;

    const partnerId = String(Number((notePartner as any)?.id));
    const cleaned = noteDraft.replace(/\r\n/g, "\n").trim();

    setPartnerNoteById((prev) => {
      if (!cleaned) {
        const { [partnerId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [partnerId]: cleaned };
    });

    setIsNoteSheetOpen(false);
    setNotePartner(null);
    setNoteDraft("");
  };

  const [draftMode, setDraftMode] = useState<DraftMode>("FINAL");

  const docPatches: TemplateBookDocPatchDTO[] = [];

  const [extraDocs, setExtraDocs] = useState<ExtraDocDraft[]>([]);
  const [extraItemsDocumentId, setExtraItemsDocumentId] = useState<number | null>(null);
  const [extraDocPickerOpen, setExtraDocPickerOpen] = useState(false);
  const [isExtraItemsEditorOpen, setIsExtraItemsEditorOpen] = useState(false);
  const [extraItemsEditorDocumentId, setExtraItemsEditorDocumentId] = useState<number | null>(null);
  const [extraItemsEditorSeed, setExtraItemsEditorSeed] = useState<TemplateItemResponseDTO[]>([]);
  const [resetDraftOpen, setResetDraftOpen] = useState(false);

  const [resultPopup, setResultPopup] = useState<ResultPopupState>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
    linkHeaderId: null,
  });

  const closeResultPopup = useCallback(() => {
    setResultPopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const draftLoadedForTemplateRef = useRef<number | null>(null);
  const skipNextDraftSaveRef = useRef(false);

  useEffect(() => {
    const id = Number(templateId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (draftLoadedForTemplateRef.current === id) return;

    draftLoadedForTemplateRef.current = id;
    const saved = templateDispatchDrafts.get(id);
    if (!saved) return;

    skipNextDraftSaveRef.current = true;
    setSelectedPartners(saved.selectedPartners ?? []);
    setPartnerNoteById(saved.partnerNoteById ?? {});
    setDraftMode(saved.draftMode ?? "FINAL");
    setExtraDocs(saved.extraDocs ?? []);
    setExtraItemsDocumentId(saved.extraItemsDocumentId ?? null);
  }, [templateId]);

  useEffect(() => {
    const id = Number(templateId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (draftLoadedForTemplateRef.current !== id) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    templateDispatchDrafts.set(id, {
      selectedPartners,
      partnerNoteById,
      draftMode,
      extraDocs,
      extraItemsDocumentId,
    });
  }, [templateId, selectedPartners, partnerNoteById, draftMode, extraDocs, extraItemsDocumentId]);

  const clearLocalDraft = useCallback(() => {
    const id = Number(templateId);
    if (Number.isFinite(id) && id > 0) templateDispatchDrafts.delete(id);
    setSelectedPartners([]);
    setPartnerNoteById({});
    setDraftMode("FINAL");
    setExtraDocs([]);
    setExtraItemsDocumentId(null);
    setExtraItemsEditorSeed([]);
    setResetDraftOpen(false);
  }, [templateId]);

  const openResultDetails = useCallback(() => {
    const id = resultPopup.linkHeaderId;
    if (!id || !Number.isFinite(id)) return;

    closeResultPopup();

    const token = `${Date.now()}_${id}`;
    requestAnimationFrame(() => {
      try {
        router.push({
          pathname: "/(tabs)/dispatch-bookings/[id]",
          params: { id: String(id), _rf: token },
        } as any);
      } catch {
        try {
          (router as any).push?.(`/(tabs)/dispatch-bookings/${id}?_rf=${encodeURIComponent(token)}`);
        } catch { }
      }
    });
  }, [resultPopup.linkHeaderId, closeResultPopup]);

  const [itemMetaById, setItemMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());

  const documentDescriptorById = useMemo(() => {
    const map = new Map<number, DocumentDescriptorResponseDTO>();
    for (const doc of (documentDescriptorsQ.data ?? []) as DocumentDescriptorResponseDTO[]) {
      const id = normDocumentId(doc);
      if (id) map.set(id, doc);
    }
    return map;
  }, [documentDescriptorsQ.data]);

  const templateDocumentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const doc of templateDocs ?? []) {
      const id = normDocumentId(doc);
      if (id) ids.add(id);
    }
    return ids;
  }, [templateDocs]);

  const templateDocumentDescriptors = useMemo(() => {
    const docs: DocumentDescriptorResponseDTO[] = [];

    for (const id of templateDocumentIds) {
      const descriptor = documentDescriptorById.get(id);
      docs.push(descriptor ?? ({
        documentId: id,
        warehouseId: 0,
        storageGroupId: 0,
        storageGroupName: "",
        documentCode: "",
        displayName: "",
        inOutFlag: 0,
        changesStock: 0,
      } as DocumentDescriptorResponseDTO));
    }

    return docs.sort(compareDocumentDescriptors);
  }, [documentDescriptorById, templateDocumentIds]);

  const primaryWarehouseId = useMemo(() => {
    for (const doc of templateDocs ?? []) {
      const documentId = normDocumentId(doc);
      const warehouseId = Number((documentDescriptorById.get(documentId) as any)?.warehouseId ?? 0);
      if (warehouseId > 0) return warehouseId;
    }
    return null;
  }, [documentDescriptorById, templateDocs]);

  const documentGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; docs: DocumentDescriptorResponseDTO[] }>();
    for (const doc of templateDocumentDescriptors) {
      const raw = Number((doc as any)?.storageGroupId);
      const id = Number.isFinite(raw) && raw > 0 ? String(raw) : `doc-${doc.documentId}`;
      const current = map.get(id) ?? {
        id,
        name: documentGroupTitle(doc, normDocumentId(doc)),
        docs: [],
      };
      current.docs.push(doc);
      map.set(id, current);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ad = a.docs[0] ?? null;
      const bd = b.docs[0] ?? null;
      return compareDocumentDescriptors(ad, bd);
    });
  }, [templateDocumentDescriptors]);

  useEffect(() => {
    if (extraItemsDocumentId && templateDocumentIds.has(extraItemsDocumentId)) return;
    const defaults = ((session as any)?.defaultWarehouseByStorageGroup ?? {}) as Record<string, number>;
    for (const group of documentGroups) {
      const preferredDoc = preferredDocumentForGroup(group, defaults);
      if (preferredDoc) {
        setExtraItemsDocumentId(normDocumentId(preferredDoc));
        return;
      }
    }

    const firstDoc = templateDocs?.[0] as any;
    const firstDocId = normDocumentId(firstDoc);
    if (firstDocId) setExtraItemsDocumentId(firstDocId);
  }, [extraItemsDocumentId, templateDocs, documentGroups, session, templateDocumentIds]);

  const extraItemsDescriptor = useMemo(
    () => extraItemsDocumentId ? documentDescriptorById.get(extraItemsDocumentId) ?? null : null,
    [documentDescriptorById, extraItemsDocumentId]
  );

  const extraItemsEditorDescriptor = useMemo(() => {
    const documentId = Number(extraItemsEditorDocumentId ?? extraItemsDocumentId ?? 0);
    return documentId ? documentDescriptorById.get(documentId) ?? null : null;
  }, [documentDescriptorById, extraItemsDocumentId, extraItemsEditorDocumentId]);

  const selectedExtraItems = useMemo(
    () => itemsForDocument(extraDocs, extraItemsDocumentId),
    [extraDocs, extraItemsDocumentId]
  );

  const sortedExtraDocs = useMemo(
    () => sortExtraDocs(extraDocs, documentDescriptorById),
    [extraDocs, documentDescriptorById]
  );

  const extraDocsPayload = useMemo(
    () => toExtraDocsPayload(sortedExtraDocs, draftMode === "DRAFT"),
    [draftMode, sortedExtraDocs]
  );

  const extraWarehouseId = useMemo(() => {
    for (const doc of extraDocsPayload ?? []) {
      const warehouseId = Number((documentDescriptorById.get(Number(doc.documentId)) as any)?.warehouseId ?? 0);
      if (warehouseId > 0) return warehouseId;
    }
    return null;
  }, [documentDescriptorById, extraDocsPayload]);

  const bookingWarehouseId = primaryWarehouseId ?? extraWarehouseId;

  const extraItemsTotalCount = useMemo(
    () => extraDocsPayload.reduce((sum, doc) => sum + Number(doc.items?.length ?? 0), 0),
    [extraDocsPayload]
  );

  const selectedExtraItemsGroupId = useMemo(() => {
    const raw = Number((extraItemsDescriptor as any)?.storageGroupId);
    if (Number.isFinite(raw) && raw > 0) return String(raw);
    return extraItemsDescriptor?.documentId ? `doc-${extraItemsDescriptor.documentId}` : null;
  }, [extraItemsDescriptor]);

  const selectedExtraItemsGroup = useMemo(
    () => documentGroups.find((group) => group.id === selectedExtraItemsGroupId) ?? documentGroups[0] ?? null,
    [documentGroups, selectedExtraItemsGroupId]
  );

  const extraDocumentPickerDocs = useMemo(
    () => selectedExtraItemsGroup?.docs ?? templateDocumentDescriptors,
    [selectedExtraItemsGroup, templateDocumentDescriptors]
  );

  useEffect(() => {
    const fromTemplate = collectItemMetaFromTemplate(templateDocs);
    if (fromTemplate.length) {
      setItemMetaById((prev) => mergeItemMeta(prev, fromTemplate));
    }
  }, [templateDocs]);

  const openExtraItemsEditor = useCallback((documentId?: number | null) => {
    const targetDocumentId = Number(documentId ?? extraItemsDocumentId ?? 0);
    if (!targetDocumentId) return;

    const targetItems = itemsForDocument(extraDocs, targetDocumentId);
    const seed: TemplateItemResponseDTO[] = (targetItems ?? []).map((x, index) => {
      const itemId = Number((x as any)?.itemId);
      const meta = itemMetaById.get(itemId);

      return {
        itemId,
        quantity: Number((x as any)?.quantity ?? 0),
        sortOrder: index + 1,
        itemName: String((x as any)?.itemName ?? (x as any)?.name ?? (meta as any)?.name ?? "").trim(),
        itemCode: String((x as any)?.itemCode ?? (x as any)?.code ?? (meta as any)?.code ?? "").trim(),
        unit: String((x as any)?.unit ?? (meta as any)?.unit ?? "").trim(),
        barcode: String((x as any)?.barcode ?? (meta as any)?.barcode ?? "").trim(),
      } as any;
    });

    setExtraItemsDocumentId(targetDocumentId);
    setExtraItemsEditorDocumentId(targetDocumentId);
    setExtraItemsEditorSeed(seed);
    setIsExtraItemsEditorOpen(true);
  }, [extraDocs, extraItemsDocumentId, itemMetaById]);

  const fetchExtraItemsPage = useCallback(
    async ({ page, size, q }: { page: number; size: number; q?: string }) => {
      const targetWarehouseId = Number((extraItemsEditorDescriptor as any)?.warehouseId ?? 0);
      if (!targetWarehouseId) {
        return {
          items: [] as ItemDescriptorResponseDTO[],
          page,
          size,
          total: 0,
        };
      }

      const res = await itemDirectoryService.pageItems({
        warehouseId: targetWarehouseId,
        page,
        size,
        q,
      });

      const items = (res.items ?? []) as ItemDescriptorResponseDTO[];
      if (items.length) {
        setItemMetaById((prev) => mergeItemMeta(prev, items));
      }

      return {
        items,
        page: Number(res.page ?? page),
        size: Number(res.size ?? size),
        total: Number(res.total ?? 0),
      };
    },
    [extraItemsEditorDescriptor]
  );

  const saveExtraItemsFromEditor = useCallback(
    async (items: TemplateItemUpsertRequestDTO[]) => {
      const documentId = Number(extraItemsEditorDocumentId ?? extraItemsDocumentId ?? 0);
      if (!documentId) return;

      const nextItems = (items ?? []).map((x) => ({
          itemId: Number((x as any)?.itemId),
          quantity: Number((x as any)?.quantity ?? 0),
          itemName: String((x as any)?.itemName ?? (x as any)?.name ?? "").trim(),
          name: String((x as any)?.name ?? (x as any)?.itemName ?? "").trim(),
          itemCode: String((x as any)?.itemCode ?? (x as any)?.code ?? "").trim(),
          code: String((x as any)?.code ?? (x as any)?.itemCode ?? "").trim(),
          unit: String((x as any)?.unit ?? "").trim(),
          barcode: String((x as any)?.barcode ?? "").trim(),
      })) as any;

      setExtraDocs((prev) => upsertExtraDocItems(prev, documentId, nextItems));

      setIsExtraItemsEditorOpen(false);
      setExtraItemsEditorDocumentId(null);
    },
    [extraItemsDocumentId, extraItemsEditorDocumentId]
  );

  const templateRowsByDocument = useMemo(() => {
    return (templateDocs ?? [])
      .slice()
      .sort((a, b) =>
        compareDocumentDescriptors(
          documentDescriptorById.get(normDocumentId(a)),
          documentDescriptorById.get(normDocumentId(b))
        )
      )
      .map((doc) => {
        const documentId = Number((doc as any)?.documentId);

        const rows = (((doc as any)?.items ?? []) as TemplateItemResponseDTO[])
          .filter((row) => Number((row as any)?.itemId) > 0 && Number((row as any)?.quantity ?? 0) > 0)
          .sort((a, b) => Number((a as any)?.itemId) - Number((b as any)?.itemId));

        return { documentId, rows, count: rows.length };
      })
      .filter((x) => x.documentId);
  }, [documentDescriptorById, templateDocs]);

  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [isValidateSummaryOpen, setIsValidateSummaryOpen] = useState(false);
  const [validateRows, setValidateRows] = useState<ValidateRow[]>([]);
  const [validateDetailRow, setValidateDetailRow] = useState<ValidateRow | null>(null);
  const [detailFromMany, setDetailFromMany] = useState(false);

  const validateLoading = validateTemplateMutation.isPending;
  const validationModalBusy = validateLoading || bookingBusy;
  const selectedValidateRow = validateDetailRow ?? (validateRows.length === 1 ? validateRows[0] : null);
  const validateData = selectedValidateRow?.data ?? null;
  const validateError =
    selectedValidateRow?.error ||
    selectedValidateRow?.warning ||
    (validateTemplateMutation.error
      ? toUserMessage(validateTemplateMutation.error, "Greška pri validaciji.")
      : null);

  const makeTemplateErrorRow = useCallback(
    (message: string, partnerId?: number | null, partnerName?: string | null): ValidateRow => ({
      partnerId: Number(partnerId ?? 0),
      partnerName: partnerName?.trim() || "Predložak",
      data: null,
      error: message,
      warning: null,
      ok: 0,
      warn: 0,
      bad: 0,
      total: 0,
    }),
    []
  );

  const openValidateModal = async () => {
    setScreenError(null);

    if (selectedPartners.length === 0) {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Odaberi partnera",
        message: "Odaberi barem jednog partnera.",
        linkHeaderId: null,
      });
      return;
    }

    if ((!templateDocs || templateDocs.length === 0) && extraDocsPayload.length === 0) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Predložak je prazan",
        message: "Predložak nema dokumenata ni dodatnih stavki.",
        linkHeaderId: null,
      });
      return;
    }

    const partnerNameById: Record<string, string> = {};
    const partnerIds = selectedPartners
      .map((partner) => {
        const partnerId = Number((partner as any)?.id);
        if (!partnerId) return null;
        partnerNameById[String(partnerId)] = partnerDisplayName(partner);
        return partnerId;
      })
      .filter(Boolean) as number[];

    if (!partnerIds.length) {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Nema stavki",
        message: "Nema stavki za validaciju.",
        linkHeaderId: null,
      });
      return;
    }

    setValidateRows([]);
    setValidateDetailRow(null);
    setDetailFromMany(false);
    validateTemplateMutation.reset();

    setIsValidateSummaryOpen(true);
    setIsValidateModalOpen(false);

    try {
      const response = await validateTemplateMutation.mutateAsync({
        templateId,
        warehouseId: bookingWarehouseId ?? undefined,
        partnerIds: partnerIds as any,
        documentDate: toLocalDateString(new Date()) as any,
        draftMode: draftMode as any,
        docPatches: docPatches as any,
        extraItems: [] as any,
        extraDocs: sortedExtraDocs as any,
        note: null as any,
      } as any);
      const rows: ValidateRow[] = ((response as any)?.results ?? []).map((row: any) => {
        const partnerId = Number(row?.partnerId);
        const data = row?.data ?? null;
        const documentId = Number(data?.documentId ?? row?.documentId ?? 0) || 0;
        const warehouseId = Number(data?.warehouseId ?? row?.warehouseId ?? 0) || 0;
        const documentCode = String(data?.documentCode ?? row?.documentCode ?? "").trim();
        const descriptor = documentId ? documentDescriptorById.get(documentId) ?? null : null;
        const fallbackSub = [
          documentCode || null,
          documentId ? `Dokument #${documentId}` : null,
          warehouseId ? `Skladište #${warehouseId}` : null,
        ].filter(Boolean).join(" • ");

        return toValidateRow({
          partnerId,
          partnerName: partnerNameById[String(partnerId)] ?? `Partner #${partnerId}`,
          contextLabel: descriptor || documentId ? documentGroupTitle(descriptor, documentId) : null,
          contextSub: descriptor ? documentGroupSubtitle(descriptor) : fallbackSub || null,
          data,
          error: row?.error ? String(row.error) : null,
          warning: null,
        });
      });

      if (!rows.length) {
        const partnerId = Number(partnerIds[0] ?? 0);
        setIsValidateModalOpen(false);
        setValidateRows([
          makeTemplateErrorRow(
            "Nema valjanih stavki za validaciju.",
            partnerId,
            partnerNameById[String(partnerId)] ?? "Partner"
          ),
        ]);
        setIsValidateSummaryOpen(true);
        return;
      }

      setValidateRows(rows);
      setIsValidateModalOpen(false);
      setIsValidateSummaryOpen(true);
    } catch (e) {
      const message = toUserMessage(e, "Greška pri validaciji.");
      const partnerId = Number(partnerIds[0] ?? 0);
      setIsValidateModalOpen(false);
      setValidateRows([
        makeTemplateErrorRow(
          message,
          partnerId,
          partnerNameById[String(partnerId)] ?? (partnerIds.length === 1 ? "Partner" : "Predložak")
        ),
      ]);
      setIsValidateSummaryOpen(true);
    }
  };

  const submitBooking = async (): Promise<boolean> => {
    if (selectedPartners.length === 0) return false;

    if ((!templateDocs || templateDocs.length === 0) && extraDocsPayload.length === 0) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Predložak je prazan",
        message: "Predložak nema dokumenata ni dodatnih stavki.",
        linkHeaderId: null,
      });
      return false;
    }

    const documentDate = toLocalDateString(new Date());

    if (selectedPartners.length === 1) {
      const partner = selectedPartners[0];
      const partnerId = Number((partner as any)?.id);
      const note = partnerNoteById[String(partnerId)] ?? null;

      try {
        const response = await bookOneMutation.mutateAsync({
          templateId,
          warehouseId: bookingWarehouseId ?? undefined,
          partnerId: (partner as any).id,
          documentDate: documentDate as any,
          draftMode: draftMode as any,
          docPatches: docPatches as any,
          extraItems: [] as any,
          extraDocs: extraDocsPayload as any,
          note: note as any,
        } as any);

        const succeeded = Number((response as any)?.succeeded ?? 0);
        const total = Number((response as any)?.total ?? 1);
        const failed = Number((response as any)?.failed ?? (succeeded > 0 ? 0 : 1));

        const createdHeaderId = extractFirstCreatedHeaderId(response);

        if (succeeded > 0 && failed === 0) clearLocalDraft();

        setResultPopup({
          visible: true,
          kind: succeeded > 0 && failed === 0 ? "success" : succeeded > 0 ? "info" : "error",
          title:
            succeeded > 0 && failed === 0
              ? "Kreiranje uspješno"
              : succeeded > 0
                ? "Djelomično uspješno"
                : "Kreiranje nije uspjelo",
          message: `Uspjeh: ${succeeded}/${total} • Neuspjeh: ${failed}`,
          linkHeaderId: succeeded > 0 ? createdHeaderId : null,
        });
        return succeeded > 0;
      } catch (e) {
        setResultPopup({
          visible: true,
          kind: "error",
          title: "Greška",
          message: toUserMessage(e, "Greška pri kreiranju."),
          linkHeaderId: null,
        });
        return false;
      }
    }

    const total = selectedPartners.length;
    let successCount = 0;
    let failCount = 0;

    for (const partner of selectedPartners) {
      const partnerId = Number((partner as any)?.id);
      const note = partnerNoteById[String(partnerId)] ?? null;

      try {
        const response = await bookOneMutation.mutateAsync({
          templateId,
          warehouseId: bookingWarehouseId ?? undefined,
          partnerId: (partner as any).id,
          documentDate: documentDate as any,
          draftMode: draftMode as any,
          docPatches: docPatches as any,
          extraItems: [] as any,
          extraDocs: extraDocsPayload as any,
          note: note as any,
        } as any);

        if ((response as any)?.succeeded > 0) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setResultPopup({
      visible: true,
      kind: failCount === 0 ? "success" : successCount === 0 ? "error" : "info",
      title:
        failCount === 0
          ? "Kreiranje uspješno"
          : successCount === 0
            ? "Kreiranje nije uspjelo"
            : "Djelomično uspješno",
      message: `Uspjeh: ${successCount}/${total} • Neuspjeh: ${failCount}`,
      linkHeaderId: null,
    });

    if (successCount > 0 && failCount === 0) clearLocalDraft();
    return successCount > 0;
  };

  const confirmValidateAndSubmit = async () => {
    setValidateDetailRow(null);
    setDetailFromMany(false);
    const created = await submitBooking();
    if (created) {
      setIsValidateModalOpen(false);
      setIsValidateSummaryOpen(false);
    }
  };

  const openDetailFromRow = useCallback((row: ValidateRow) => {
    setValidateDetailRow(row);
    setDetailFromMany(true);
    setIsValidateSummaryOpen(false);
    setIsValidateModalOpen(true);
  }, []);

  return (
    <Screen>
      <NavigationHeader
        title="Otpremi"
        subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
        fallbackHref={{
          pathname: "/(tabs)/templates/template/[id]",
          params: { id: String(templateId) },
        } as any}
        right={
          <Pressable
            style={s.iconBtn}
            onPress={() => setResetDraftOpen(true)}
            hitSlop={10}
            accessibilityLabel="Resetiraj lokalni nacrt"
          >
            <FontAwesome name="refresh" size={18} color={Colors.dangerText} />
          </Pressable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Zatvori"
            onAction={closeTopError}
            titleLines={1}
            messageLines={4}
          />
        )}

        <Text style={s.label}>Način knjiženja</Text>
        <Segmented<DraftMode>
          value={draftMode}
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "FINAL", label: "Final" },
          ]}
          onChange={setDraftMode}
        />

        <Pressable
          style={s.primary}
          onPress={() => {
            setScreenError(null);
            setDismissedTopError(null);
            setIsPartnerPickerOpen(true);
          }}
        >
          <Text style={s.primaryText}>
            {selectedPartners.length === 0 ? "Odaberi partnere" : `Odabrano: ${selectedPartners.length}`}
          </Text>
        </Pressable>

        <Text style={s.label}>Stavke po dokumentu (default iz predloška)</Text>

        {templateQuery.isLoading ? (
          <Text style={s.helper}>Učitavam predložak…</Text>
        ) : templateRowsByDocument.length === 0 ? (
          <Text style={s.helper}>Nema dokumenata / stavki u predlošku.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {templateRowsByDocument.map((group) => {
              const descriptor = documentDescriptorById.get(group.documentId) ?? null;
              const tone = documentTone(descriptor);

              return (
              <View
                key={String(group.documentId)}
                style={[
                  s.cardCol,
                  tone === "social" && s.cardColSocial,
                  tone === "donation" && s.cardColDonation,
                ]}
              >
                  <View style={s.cardHeaderInline}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>
                        {documentGroupTitle(descriptor, group.documentId)}
                      </Text>
                      <Text style={s.sub} numberOfLines={2}>
                        {documentGroupSubtitle(descriptor)}
                      </Text>
                      <Text style={s.sub}>Default stavki: {group.count}</Text>
                    </View>

                  </View>

                {group.count === 0 ? (
                  <Text style={s.muted}>Nema stavki.</Text>
                ) : (
                  <View style={s.rowsWrap}>
                    {group.rows.map((row) => {
                      const itemId = Number((row as any)?.itemId);
                      const quantity = Number((row as any)?.quantity ?? 0);
                      const display = formatItemDisplay(itemId, itemMetaById, row);

                      return (
                        <View
                          key={String(itemId)}
                          style={[
                            s.simpleRow,
                            tone === "social" && s.simpleRowSocial,
                            tone === "donation" && s.simpleRowDonation,
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

                          <Text style={s.simpleRight}>x{quantity}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
            })}
          </View>
        )}

        <Text style={s.label}>Dodane stavke van dokumenta</Text>

        <View style={s.cardCol}>
          <Text style={s.title}>Dodano van dokumenta</Text>
          <Text style={s.sub}>Ukupno stavki: {extraItemsTotalCount}</Text>

          {documentGroups.length > 1 ? (
            <View style={s.tabs}>
              {documentGroups.map((group) => {
                const active = selectedExtraItemsGroupId === group.id;
                const tone = documentToneFromText(group.name);
                return (
                  <Pressable
                    key={group.id}
                    style={[
                      s.tabBtn,
                      tone === "social" && s.tabBtnSocial,
                      tone === "donation" && s.tabBtnDonation,
                      active && s.tabBtnActive,
                      active && tone === "social" && s.tabBtnActiveSocial,
                      active && tone === "donation" && s.tabBtnActiveDonation,
                    ]}
                    onPress={() => {
                      const defaults = ((session as any)?.defaultWarehouseByStorageGroup ?? {}) as Record<string, number>;
                      const preferredDoc = preferredDocumentForGroup(group, defaults);
                      const docId = normDocumentId(preferredDoc);
                      if (!docId || docId === extraItemsDocumentId) return;
                      setExtraItemsEditorSeed([]);
                      setExtraItemsDocumentId(docId);
                    }}
                  >
                    <Text style={[s.tabText, active && s.tabTextActive]} numberOfLines={2}>
                      {group.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View
            style={[
              s.docContext,
              documentTone(extraItemsDescriptor) === "social" && s.docContextSocial,
              documentTone(extraItemsDescriptor) === "donation" && s.docContextDonation,
              bookingBusy && s.disabled,
            ]}
          >
            <Pressable
              style={s.docContextPicker}
              onPress={() => setExtraDocPickerOpen(true)}
              disabled={bookingBusy}
            >
              <View
                style={[
                  s.docIcon,
                  documentTone(extraItemsDescriptor) === "social" && s.docIconSocial,
                  documentTone(extraItemsDescriptor) === "donation" && s.docIconDonation,
                ]}
              >
                <FontAwesome name="file-text-o" size={18} color={Colors.text} />
              </View>
              <View style={s.docTextBlock}>
                <Text style={s.docLabel} numberOfLines={2}>
                  {documentGroupTitle(extraItemsDescriptor, extraItemsDocumentId)}
                </Text>
                <Text style={s.docSub} numberOfLines={2}>
                  {documentGroupSubtitle(extraItemsDescriptor)}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={18} color={Colors.sub} />
            </Pressable>

            <Pressable
              style={[s.docAddBtn, (bookingBusy || !extraItemsDocumentId) && s.disabled]}
              disabled={bookingBusy || !extraItemsDocumentId}
              onPress={() => openExtraItemsEditor()}
            >
              <FontAwesome name={selectedExtraItems.length ? "pencil" : "plus"} size={13} color={Colors.text} />
              <Text style={s.docAddText}>
                {selectedExtraItems.length ? `Uredi (${selectedExtraItems.length})` : "Dodaj"}
              </Text>
            </Pressable>
          </View>

          {sortedExtraDocs.length === 0 ? (
            <Text style={s.muted}>Nema dodanih stavki.</Text>
          ) : (
            <View style={s.rowsWrap}>
              {sortedExtraDocs.map((doc) => {
                const descriptor = documentDescriptorById.get(Number(doc.documentId)) ?? null;
                return (
                  <View
                    key={String(doc.documentId)}
                    style={[
                      s.patchWrap,
                      documentTone(descriptor) === "social" && s.patchWrapSocial,
                      documentTone(descriptor) === "donation" && s.patchWrapDonation,
                    ]}
                  >
                    <View style={s.cardHeaderInline}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.blockTitle} numberOfLines={2}>
                          {documentGroupTitle(descriptor, doc.documentId)}
                        </Text>
                        <Text style={s.muted} numberOfLines={2}>
                          {documentGroupSubtitle(descriptor)}
                        </Text>
                      </View>

                      <Pressable
                        style={s.secondaryBtn}
                        disabled={bookingBusy}
                        onPress={() => openExtraItemsEditor(Number(doc.documentId))}
                      >
                        <Text style={s.secondaryText}>Uredi</Text>
                      </Pressable>
                    </View>

                    {(doc.items ?? [])
                      .slice()
                      .sort((a, b) => Number((a as any)?.itemId) - Number((b as any)?.itemId))
                      .map((row) => {
                        const itemId = Number((row as any)?.itemId);
                        const quantity = Number((row as any)?.quantity ?? 0);
                        const display = formatItemDisplay(itemId, itemMetaById, row as any);
                        const tone = documentTone(descriptor);

                        return (
                          <View
                            key={`${doc.documentId}-${itemId}`}
                            style={[
                              s.simpleRow,
                              tone === "social" && s.simpleRowSocial,
                              tone === "donation" && s.simpleRowDonation,
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

                            <Text style={s.simpleRight}>x{quantity}</Text>
                          </View>
                        );
                      })}
                  </View>
                );
              })}
            </View>
          )}

          <Text style={[s.helper, { marginTop: 8 }]}>
            Dodatne stavke se knjiže kroz odabrani dokument i njegovo skladište.
          </Text>
        </View>

        <Pressable
          style={[
            s.primary,
            (selectedPartners.length === 0 || bookingBusy || validateLoading) && s.disabled,
          ]}
          disabled={selectedPartners.length === 0 || bookingBusy || validateLoading}
          onPress={openValidateModal}
        >
          <Text style={s.primaryText}>{bookingBusy || validateLoading ? "Radim…" : "Validiraj i kreiraj"}</Text>
        </Pressable>

        <Text style={s.label}>Odabrani partneri</Text>

        <FlatList
          data={selectedPartners}
          keyExtractor={(item) => String((item as any)?.id)}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const partnerId = String(Number((item as any)?.id));
            const note = partnerNoteById[partnerId] ?? "";
            const hasNote = !!note.trim();
            const notePreview = note.length > 46 ? `${note.slice(0, 45).trimEnd()}…` : note;

            return (
              <View style={s.cardSelected}>
                <View style={s.checkDotSelected}>
                  <Text style={s.checkDotTextSelected}>✓</Text>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.title}>{(item as any)?.name}</Text>
                  <Text style={s.sub}>
                    #{(item as any)?.partnerNumber} • {(item as any)?.city}
                  </Text>

                  <View style={s.partnerActionsRow}>
                    <Pressable style={s.noteBtn} onPress={() => openPartnerNote(item)}>
                      <FontAwesome name="sticky-note" size={14} color={Colors.text} />
                      <Text style={s.noteBtnText}>{hasNote ? "Uredi bilješku" : "Dodaj bilješku"}</Text>
                    </Pressable>

                    {hasNote && (
                      <View style={s.notePill}>
                        <Text style={s.notePillText}>{notePreview}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Pressable style={s.remove} onPress={() => togglePartnerSelection(item)}>
                  <Text style={s.removeText}>Obriši</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>Nema odabranih partnera.</Text>}
        />

        <SearchPickerSheet<PartnerResponseDTO>
          visible={isPartnerPickerOpen}
          title="Odaberi partnere"
          onClose={() => setIsPartnerPickerOpen(false)}
          keyOf={(partner) => String((partner as any)?.id)}
          queryKeyBase={["partners", "picker"]}
          queryPage={({ page, size, q, signal }) =>
            partnerService.pagePartners(
              { page, size, q: q ?? "" },
              signal
            ).then((response) => ({
              items: response.items ?? [],
              page: Number(response.page ?? page),
              size: Number(response.size ?? size),
              total: Number(response.total ?? 0),
            }))
          }
          staleTime={16 * 60 * 60 * 1000}
          gcTime={24 * 60 * 60 * 1000}
          renderFooter={(close) => (
            <View style={s.pickerFooterRow}>
              <Pressable
                style={[s.pickerFooterBtn, s.pickerFooterPrimary]}
                onPress={close}
              >
                <Text style={s.pickerFooterPrimaryText}>Spremi</Text>
              </Pressable>

              <Pressable
                style={[s.pickerFooterBtn, s.pickerFooterSecondary]}
                onPress={close}
              >
                <Text style={s.pickerFooterSecondaryText}>Zatvori</Text>
              </Pressable>
            </View>
          )}
          renderRow={(partner) => {
            const partnerId = Number((partner as any)?.id);
            const isSelected = selectedPartnerIds.has(partnerId);

            return (
              <Pressable
                style={[s.pickRow, isSelected && s.pickRowSelected]}
                onPress={() => togglePartnerSelection(partner)}
              >
                <View style={s.pickLeft}>
                  <View style={[s.checkDot, isSelected && s.checkDotSelected]}>
                    <Text style={[s.checkDotText, isSelected && { color: "#fff" }]}>
                      {isSelected ? "✓" : "+"}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.pickTitle}>{(partner as any)?.name}</Text>
                    <Text style={s.pickSub}>
                      #{(partner as any)?.partnerNumber} • {(partner as any)?.city}
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

        <CenterSheet
          visible={isNoteSheetOpen}
          title="Bilješka za partnera"
          onClose={() => {
            if (bookingBusy) return;
            setIsNoteSheetOpen(false);
            setNotePartner(null);
          }}
          closeOnBackdrop={false}
          disableClose={bookingBusy}
          width={MAX_W}
        >
          {!!notePartner && (
            <Text style={s.noteTargetLabel}>
              {(notePartner as any)?.name} • #{(notePartner as any)?.partnerNumber}
            </Text>
          )}

          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder="Upiši bilješku (npr. 'Dostaviti do 12h', 'Nazvati prije dostave'...)"
            placeholderTextColor={"rgba(148,163,184,0.85)"}
            style={s.noteInput}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
          />

          <View style={{ gap: 12 }}>
            <Pressable style={s.primary} onPress={savePartnerNote} disabled={bookingBusy}>
              <Text style={s.primaryText}>Spremi bilješku</Text>
            </Pressable>

            <Pressable
              style={s.btnWide}
              onPress={() => {
                if (bookingBusy) return;
                setIsNoteSheetOpen(false);
                setNotePartner(null);
              }}
              disabled={bookingBusy}
            >
              <Text style={s.btnText}>Zatvori</Text>
            </Pressable>

            <Pressable style={s.secondaryBtn} onPress={() => setNoteDraft("")} disabled={bookingBusy}>
              <Text style={s.secondaryText}>Obriši unos</Text>
            </Pressable>
          </View>
        </CenterSheet>
      </ScrollView>

      <TemplateDocItemsEditorModal
        visible={isExtraItemsEditorOpen}
        title="Dodaj stavke van dokumenta"
        documentId={extraItemsEditorDocumentId ?? extraItemsDocumentId}
        documentLabel={documentGroupTitle(extraItemsEditorDescriptor, extraItemsEditorDocumentId ?? extraItemsDocumentId)}
        documentSubtitle={documentGroupSubtitle(extraItemsEditorDescriptor)}
        initialItems={extraItemsEditorSeed}
        loading={bookingBusy}
        onClose={() => {
          if (bookingBusy) return;
          setIsExtraItemsEditorOpen(false);
          setExtraItemsEditorDocumentId(null);
        }}
        onSave={saveExtraItemsFromEditor}
        fetchItemsPage={fetchExtraItemsPage}
      />

      <SearchPickerSheet<DocumentDescriptorResponseDTO>
        visible={extraDocPickerOpen}
        title="Odaberi dokument za dodatne stavke"
        onClose={() => setExtraDocPickerOpen(false)}
        keyOf={(doc) => String(doc.documentId)}
        queryKeyBase={["template-dispatch", "extra-doc-picker", templateId, selectedExtraItemsGroupId ?? "none"] as const}
        queryPage={async ({ page, size, q }) => {
          const all = filterDocumentDescriptors(extraDocumentPickerDocs, q)
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
              const docId = normDocumentId(doc);
              if (!docId) return;
              if (docId !== extraItemsDocumentId) setExtraItemsEditorSeed([]);
              setExtraItemsDocumentId(docId);
              close();
              requestAnimationFrame(() => openExtraItemsEditor(docId));
            }}
          >
            <View style={s.pickTextBlock}>
              <Text style={s.pickTitle} numberOfLines={2}>{documentGroupTitle(doc, normDocumentId(doc))}</Text>
              <Text style={s.pickSub} numberOfLines={2}>{documentGroupSubtitle(doc)}</Text>
            </View>
          </Pressable>
        )}
      />

      <CenterConfirmSheet
        visible={resetDraftOpen}
        title="Resetirati lokalni nacrt?"
        description="Ovo će obrisati odabrane partnere, bilješke i dodatne stavke unesene na ovom ekranu."
        confirmText="Resetiraj"
        cancelText="Odustani"
        danger
        loading={false}
        onClose={() => setResetDraftOpen(false)}
        onConfirm={clearLocalDraft}
      />

      <ValidateImpactModal
        visible={isValidateModalOpen}
        onClose={() => {
          if (validationModalBusy) return;
          setIsValidateModalOpen(false);

          if (detailFromMany) {
            setIsValidateSummaryOpen(true);
            setDetailFromMany(false);
            setValidateDetailRow(null);
          }
        }}
        disableClose={validationModalBusy}
        loading={validationModalBusy}
        loadingTitle={bookingBusy ? "Kreiram…" : "Provjeravam…"}
        loadingSubtitle={bookingBusy ? "Kreiram otpremnice za odabrane partnere." : "Analiziram stavke i očekivane promjene."}
        error={validateError}
        data={validateData}
        onConfirm={confirmValidateAndSubmit}
        confirmText="Kreiraj"
        showConfirm={!detailFromMany}
      />

      <ValidateManyModal
        visible={isValidateSummaryOpen}
        loading={validationModalBusy}
        rows={validateRows}
        disableClose={validationModalBusy}
        onClose={() => {
          if (validationModalBusy) return;
          setIsValidateSummaryOpen(false);
          setDetailFromMany(false);
          setValidateDetailRow(null);
        }}
        onConfirm={confirmValidateAndSubmit}
        onOpenDetail={openDetailFromRow}
        title="Validacija prije knjiženja"
        subtitle="Provjera po partneru prije kreiranja otpremnica."
        confirmText="Kreiraj za odabrane partnere"
        disabledConfirmText="Ispravi prije kreiranja"
        loadingTitle={bookingBusy ? "Kreiram…" : "Provjeravam…"}
        loadingSubtitle={bookingBusy ? "Kreiram otpremnice za odabrane partnere." : "Molim pričekaj."}
      />

      <InfoResultPopup
        visible={resultPopup.visible}
        variant={resultPopup.kind}
        title={resultPopup.title}
        message={resultPopup.message}
        subtitle={
          resultPopup.linkHeaderId && resultPopup.kind === "success"
            ? "Možeš otvoriti otpremnicu i provjeriti status."
            : undefined
        }
        linkText={resultPopup.linkHeaderId ? `Otvori otpremnicu #${resultPopup.linkHeaderId}` : undefined}
        onLinkPress={resultPopup.linkHeaderId ? openResultDetails : undefined}
        buttonText="U redu"
        onClose={closeResultPopup}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}
