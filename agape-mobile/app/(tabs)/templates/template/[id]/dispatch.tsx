import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/constants/Colors";

import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";
import ValidateImpactModal from "@/components/ValidateImpactModal";
import { TemplateDocItemsEditorModal } from "@/components/TemplateDocItemsEditorModal";
import InfoResultPopup from "@/components/InfoResultPopup";

import type {
  DraftMode,
  DispatchRequestValidationDTO,
  ItemDescriptorResponseDTO,
  PartnerResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  TemplateDocResponseDTO,
  TemplateItemResponseDTO,
  TemplateItemUpsertRequestDTO,
} from "@/app/models/generated";

import { toUserMessage } from "@/app/api/apiClient";
import { partnerService } from "@/app/api/services/partnerService";
import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { useDispatchValidate } from "@/app/api/hooks/useDispatchValidate";
import { toLocalDateString } from "@/app/utils/dateIso";
import { useBookTemplateOne, useTemplateDetail } from "@/app/api/hooks/templates/useDispatchTemplates";
import { useItemDirectoryPickerPage } from "@/app/api/hooks/documents/useItemDirectoryPickerPage";

import { MAX_W, s } from "../../styles/TemplateDispatch.styles";

type PartnerNoteMap = Record<string, string>;

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
      name: rowName || `Artikl #${itemId}`,
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
    name: name || `Artikl #${itemId}`,
    meta: subtitle,
  };
}

function buildValidatePayload(args: {
  warehouseId: number;
  partnerId: number;
  draftMode: DraftMode;
  templateDocs: TemplateDocResponseDTO[];
  docPatches: TemplateBookDocPatchDTO[];
  extraItems: TemplateBookItemDTO[];
  note?: string | null;
}): DispatchRequestValidationDTO {
  const { warehouseId, partnerId, draftMode, templateDocs, docPatches, extraItems, note } = args;

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

  for (const row of extraItems ?? []) {
    add((row as any)?.itemId, (row as any)?.quantity);
  }

  const items = Object.entries(totalByItemId)
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

  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const templateQuery = useTemplateDetail(templateId, { includeItemMeta: true });
  const template = templateQuery.data;
  const templateDocs: TemplateDocResponseDTO[] = (template?.documents ?? []) as any;

  const bookOneMutation = useBookTemplateOne();
  const validateMutation = useDispatchValidate();

  const { fetchItemsPage: fetchItemsPageBase } = useItemDirectoryPickerPage({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    enabled: true,
  });

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  const rawTopError =
    screenError ||
    templateQuery.errorMessage ||
    (bookOneMutation.error ? toUserMessage(bookOneMutation.error, "Greška pri kreiranju.") : null);

  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  const closeTopError = () => {
    setScreenError(null);
    setDismissedTopError(rawTopError ?? null);
    bookOneMutation.reset();
  };

  const refreshing = templateQuery.isFetching;
  const onRefresh = () => {
    void templateQuery.refetch();
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

  const [extraItems, setExtraItems] = useState<TemplateBookItemDTO[]>([]);
  const [isExtraItemsEditorOpen, setIsExtraItemsEditorOpen] = useState(false);
  const [extraItemsEditorSeed, setExtraItemsEditorSeed] = useState<TemplateItemResponseDTO[]>([]);

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

  useEffect(() => {
    const fromTemplate = collectItemMetaFromTemplate(templateDocs);
    if (fromTemplate.length) {
      setItemMetaById((prev) => mergeItemMeta(prev, fromTemplate));
    }
  }, [templateDocs]);

  const openExtraItemsEditor = useCallback(() => {
    const seed: TemplateItemResponseDTO[] = (extraItems ?? []).map((x, index) => {
      const itemId = Number((x as any)?.itemId);
      const meta = itemMetaById.get(itemId);

      return {
        itemId,
        quantity: Number((x as any)?.quantity ?? 0),
        sortOrder: index + 1,
        itemName: (meta as any)?.name,
        itemCode: (meta as any)?.code,
        unit: (meta as any)?.unit,
        barcode: (meta as any)?.barcode,
      } as any;
    });

    setExtraItemsEditorSeed(seed);
    setIsExtraItemsEditorOpen(true);
  }, [extraItems, itemMetaById]);

  const fetchExtraItemsPage = useCallback(
    async ({ page, size, q }: { page: number; size: number; q?: string }) => {
      const res = await fetchItemsPageBase({ page, size, q });

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
    [fetchItemsPageBase]
  );

  const saveExtraItemsFromEditor = useCallback(
    async (items: TemplateItemUpsertRequestDTO[]) => {
      setExtraItems(
        (items ?? []).map((x) => ({
          itemId: Number((x as any)?.itemId),
          quantity: Number((x as any)?.quantity ?? 0),
        })) as any
      );

      setIsExtraItemsEditorOpen(false);
    },
    []
  );

  const templateRowsByDocument = useMemo(() => {
    return (templateDocs ?? [])
      .map((doc) => {
        const documentId = Number((doc as any)?.documentId);

        const rows = (((doc as any)?.items ?? []) as TemplateItemResponseDTO[])
          .filter((row) => Number((row as any)?.itemId) > 0 && Number((row as any)?.quantity ?? 0) > 0)
          .sort((a, b) => Number((a as any)?.itemId) - Number((b as any)?.itemId));

        return { documentId, rows, count: rows.length };
      })
      .filter((x) => x.documentId);
  }, [templateDocs]);

  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);

  const validateLoading = validateMutation.isPending;
  const validateData = validateMutation.data ?? null;
  const validateError = validateMutation.error
    ? toUserMessage(validateMutation.error, "Greška pri validaciji.")
    : null;

  const openValidateModal = async () => {
    setScreenError(null);

    if (!warehouseId) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Nedostaje skladište",
        message: "Nema skladišta.",
        linkHeaderId: null,
      });
      return;
    }

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

    if (!templateDocs || templateDocs.length === 0) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Predložak je prazan",
        message: "Predložak nema dokumenata.",
        linkHeaderId: null,
      });
      return;
    }

    if (selectedPartners.length !== 1) {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Validacija ograničena",
        message: "Validacija trenutno radi samo za 1 partnera. Odaberi točno jednog partnera.",
        linkHeaderId: null,
      });
      return;
    }

    const partner = selectedPartners[0];
    const partnerId = Number((partner as any)?.id);
    const note = partnerNoteById[String(partnerId)] ?? null;

    const payload = buildValidatePayload({
      warehouseId,
      partnerId,
      draftMode,
      templateDocs,
      docPatches,
      extraItems,
      note,
    });

    if (!payload.items || (payload.items as any[]).length === 0) {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Nema stavki",
        message: "Nema stavki za validaciju.",
        linkHeaderId: null,
      });
      return;
    }

    setIsValidateModalOpen(true);
    validateMutation.reset();

    try {
      await validateMutation.mutateAsync(payload as any);
    } catch {
    }
  };

  const submitBooking = async () => {
    if (!warehouseId || selectedPartners.length === 0) return;

    if (!templateDocs || templateDocs.length === 0) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Predložak je prazan",
        message: "Predložak nema dokumenata.",
        linkHeaderId: null,
      });
      return;
    }

    const documentDate = toLocalDateString(new Date());

    if (selectedPartners.length === 1) {
      const partner = selectedPartners[0];
      const partnerId = Number((partner as any)?.id);
      const note = partnerNoteById[String(partnerId)] ?? null;

      try {
        const response = await bookOneMutation.mutateAsync({
          templateId,
          warehouseId,
          partnerId: (partner as any).id,
          documentDate: documentDate as any,
          draftMode: draftMode as any,
          docPatches: docPatches as any,
          extraItems: extraItems as any,
          extraDocuments: [] as any,
          note: note as any,
        } as any);

        const succeeded = Number((response as any)?.succeeded ?? 0);
        const total = Number((response as any)?.total ?? 1);
        const failed = Number((response as any)?.failed ?? (succeeded > 0 ? 0 : 1));

        const createdHeaderId = extractFirstCreatedHeaderId(response);

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
      } catch (e) {
        setResultPopup({
          visible: true,
          kind: "error",
          title: "Greška",
          message: toUserMessage(e, "Greška pri kreiranju."),
          linkHeaderId: null,
        });
      }

      return;
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
          warehouseId,
          partnerId: (partner as any).id,
          documentDate: documentDate as any,
          draftMode: draftMode as any,
          docPatches: docPatches as any,
          extraItems: extraItems as any,
          extraDocuments: [] as any,
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
  };

  const confirmValidateAndSubmit = async () => {
    setIsValidateModalOpen(false);
    await submitBooking();
  };

  if (ready && !warehouseId) {
    return (
      <Screen>
        <NavigationHeader
          title="Otpremi"
          subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
          fallbackHref="/(tabs)/templates"
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ErrorCard
            title="Nedostaje glavno skladište"
            message="U Postavkama prvo odaberi glavno skladište da bi mogao koristiti otpremu iz predloška."
            actionText="Zatvori"
            onAction={() => { }}
            titleLines={2}
            messageLines={3}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavigationHeader
        title="Otpremi"
        subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
        fallbackHref="/(tabs)/templates"
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
            {templateRowsByDocument.map((group) => (
              <View key={String(group.documentId)} style={s.cardCol}>
                <View style={s.cardHeaderInline}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>Dokument #{group.documentId}</Text>
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
                        <View key={String(itemId)} style={s.simpleRow}>
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
            ))}
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.label}>Dodane stavke van dokumenta</Text>

          <Pressable
            style={[s.secondaryBtn, (bookingBusy || !warehouseId) && s.disabled]}
            disabled={bookingBusy || !warehouseId}
            onPress={openExtraItemsEditor}
          >
            <Text style={s.secondaryText}>
              {extraItems.length ? `Uredi (${extraItems.length})` : "+ Dodaj"}
            </Text>
          </Pressable>
        </View>

        <View style={s.cardCol}>
          <Text style={s.title}>Dodano van dokumenta</Text>
          <Text style={s.sub}>Stavki: {extraItems.length}</Text>

          {extraItems.length === 0 ? (
            <Text style={s.muted}>Nema dodanih stavki.</Text>
          ) : (
            <View style={s.rowsWrap}>
              {extraItems
                .slice()
                .sort((a, b) => Number((a as any)?.itemId) - Number((b as any)?.itemId))
                .map((row) => {
                  const itemId = Number((row as any)?.itemId);
                  const quantity = Number((row as any)?.quantity ?? 0);
                  const display = formatItemDisplay(itemId, itemMetaById);

                  return (
                    <View key={String(itemId)} style={s.simpleRow}>
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

          <Text style={[s.helper, { marginTop: 8 }]}>Ove stavke nisu vezane uz određeni dokument.</Text>
        </View>

        <Pressable
          style={[
            s.primary,
            (selectedPartners.length === 0 || !warehouseId || bookingBusy || validateLoading) && s.disabled,
          ]}
          disabled={selectedPartners.length === 0 || !warehouseId || bookingBusy || validateLoading}
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
                      <Text style={s.noteBtnText}>{hasNote ? "Uredi note" : "Dodaj note"}</Text>
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
          fetchPage={async ({ page, size, q }) => {
            const response = await partnerService.pagePartners({ page, size, q: q ?? "" });
            return {
              items: response.items,
              page: response.page,
              size: response.size,
              total: response.total,
            };
          }}
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
          title="Note za partnera"
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
            placeholder="Upiši note (npr. 'Dostaviti do 12h', 'Nazvati prije dostave'...)"
            placeholderTextColor={"rgba(148,163,184,0.85)"}
            style={s.noteInput}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
          />

          <View style={{ gap: 12 }}>
            <Pressable style={s.primary} onPress={savePartnerNote} disabled={bookingBusy}>
              <Text style={s.primaryText}>Spremi note</Text>
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
        documentId={null}
        initialItems={extraItemsEditorSeed}
        loading={bookingBusy}
        onClose={() => {
          if (bookingBusy) return;
          setIsExtraItemsEditorOpen(false);
        }}
        onSave={saveExtraItemsFromEditor}
        fetchItemsPage={fetchExtraItemsPage}
      />

      <ValidateImpactModal
        visible={isValidateModalOpen}
        onClose={() => {
          if (bookingBusy || validateLoading) return;
          setIsValidateModalOpen(false);
        }}
        disableClose={bookingBusy || validateLoading}
        loading={validateLoading}
        error={validateError}
        data={validateData}
        onConfirm={confirmValidateAndSubmit}
        confirmText="Kreiraj"
      />

      <InfoResultPopup
        visible={resultPopup.visible}
        variant={resultPopup.kind}
        title={resultPopup.title}
        message={resultPopup.message}
        subtitle={
          resultPopup.linkHeaderId && resultPopup.kind === "success"
            ? "Možeš otvoriti dispatch i provjeriti status."
            : undefined
        }
        linkText={resultPopup.linkHeaderId ? `Otvori Dispatch #${resultPopup.linkHeaderId}` : undefined}
        onLinkPress={resultPopup.linkHeaderId ? openResultDetails : undefined}
        buttonText="U redu"
        onClose={closeResultPopup}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}