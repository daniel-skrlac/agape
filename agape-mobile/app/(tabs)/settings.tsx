import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import { ErrorCard } from "@/components/ErrorCard";

import Strings from "@/src/constants/Strings";

import { useCurrentUser } from "../../src/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "../../src/api/hooks/common/usePullToRefresh";
import { useMainWarehouseSettingsForm } from "../../src/api/hooks/settings/useSettingsForm";

import WarehousePickerCard from "@/components/WarehousePickerCard";
import { documentDirectoryService } from "@/src/api/services/documentDirectoryService";
import type { DocumentDescriptorResponseDTO } from "@/src/models/generated";

import { styles as S } from "../../src/styles/SettingsScreen.styles";
import { toUserMessage } from "../../src/api/apiClient";

export default function SettingsScreen() {
  const { session, ready } = useCurrentUser();
  const userId = (session?.userId ?? null) as number | null;

  const savedByStorageGroup = (session?.defaultWarehouseByStorageGroup ?? {}) as Record<string, number>;

  const form = useMainWarehouseSettingsForm({
    userId,
    savedWarehouseByStorageGroup: savedByStorageGroup,
  });

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const [retryingDocuments, setRetryingDocuments] = useState(false);
  const [hideTopError, setHideTopError] = useState(false);

  const allDocumentTypesQ = useQuery({
    queryKey: ["settings", "dispatch-doc-types", "ALL_GROUPS"],
    queryFn: ({ signal }) =>
      documentDirectoryService.listDocTypesByCode(
        {
          documentCode: "OTPREMNICA",
        },
        signal
      ),
    staleTime: 16 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const retryDocuments = useCallback(async () => {
    setHideTopError(true);
    setRetryingDocuments(true);
    setOpenGroupId(null);
    form.clearStatus();

    try {
      await Promise.resolve(allDocumentTypesQ.refetch());
    } catch {
    } finally {
      setRetryingDocuments(false);
      setHideTopError(false);
    }
  }, [allDocumentTypesQ, form]);

  const refreshDocumentsQuietly = useCallback(async () => {
    form.clearStatus();
    await Promise.resolve(allDocumentTypesQ.refetch());
  }, [allDocumentTypesQ, form]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setHideTopError(false);
        setRetryingDocuments(false);
        form.resetToSaved(savedByStorageGroup);
      };
    }, [form.resetToSaved, savedByStorageGroup])
  );

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      await refreshDocumentsQuietly();
      form.resetToSaved(savedByStorageGroup);
    },
  ]);

  const documentGroups = useMemo(
    () => buildDocumentGroups((allDocumentTypesQ.data ?? []) as DocumentDescriptorResponseDTO[]),
    [allDocumentTypesQ.data]
  );

  const documentErrorMessage = useMemo(
    () => (allDocumentTypesQ.error ? toUserMessage(allDocumentTypesQ.error) : null),
    [allDocumentTypesQ.error]
  );

  const topError = useMemo(() => form.errors.formError || documentErrorMessage, [form.errors.formError, documentErrorMessage]);
  const visibleTopError = useMemo(() => (hideTopError ? null : topError), [hideTopError, topError]);

  const topErrorActionText = useMemo(() => (documentErrorMessage ? "Pokušaj ponovno" : "Zatvori"), [documentErrorMessage]);
  const initialDocumentsLoading = allDocumentTypesQ.isLoading && documentGroups.length === 0 && !documentErrorMessage;

  const onTopErrorAction = useCallback(() => {
    if (documentErrorMessage) {
      void retryDocuments();
      return;
    }
    form.clearStatus();
  }, [documentErrorMessage, retryDocuments, form]);

  if (!ready) {
    return (
      <Screen style={S.screen}>
        <View style={S.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom", "left", "right"]} style={S.screen}>
      <TabScroll withScreen={false} refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={S.container}>
        <View style={S.card}>
          <Text style={S.title}>Postavke otpremnica</Text>
          <Text style={S.sub}>
            Odaberi zadano skladište za svaku grupu otpremnice. Ti odabiri se koriste kao početna vrijednost u predlošcima, evidencijama, skeniranju i dodatnim stavkama.
          </Text>

          {!!form.successMessage ? (
            <View style={S.okPill}>
              <Text style={S.okPillText}>{form.successMessage}</Text>
            </View>
          ) : null}

          {!!visibleTopError ? (
            <View style={S.errorCardWrap}>
              <ErrorCard
                title="Greška"
                message={visibleTopError}
                actionText={topErrorActionText}
                onAction={onTopErrorAction}
                disabled={retryingDocuments || refreshing}
                titleLines={1}
                messageLines={2}
              />
            </View>
          ) : null}

          {initialDocumentsLoading ? (
            <View style={S.initialLoadingBlock}>
              <ActivityIndicator color="#F97316" />
              <Text style={S.initialLoadingTitle}>Učitavam postavke otpremnica...</Text>
              <Text style={S.initialLoadingText}>Pripremam zadana skladišta i dokumente.</Text>
            </View>
          ) : documentGroups.length > 0 ? (
            <View style={S.groupDefaultsBlock}>
              <Text style={S.groupDefaultsTitle}>Zadana skladišta</Text>
              <Text style={S.groupDefaultsText}>
                Svaka grupa otpremnice ima vlastito skladište i vlastite artikle.
              </Text>

              {documentGroups.map((group) => {
                const key = String(group.storageGroupId);
                const selected = form.values.warehouseByStorageGroup[key] ?? null;
                const selectedDoc = selected
                  ? group.documents.find((doc) => Number(doc.warehouseId) === selected) ?? null
                  : null;
                const openGroup = openGroupId === key;

                return (
                  <WarehousePickerCard
                    key={key}
                    style={{ marginTop: 10 }}
                    labelText={group.name}
                    changeHintText={Strings.home.warehouse.changeHint}
                    loadingText={Strings.settings.mainWarehouse.loading}
                    emptyText="Nema skladišta za ovu grupu."
                    open={openGroup}
                    onToggle={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setOpenGroupId((prev) => (prev === key ? null : key));
                    }}
                    warehouses={group.warehouseIds}
                    loading={!!allDocumentTypesQ.isLoading || retryingDocuments}
                    error={allDocumentTypesQ.error}
                    onRetry={() => {
                      void retryDocuments();
                    }}
                    selectedId={selected}
                    selectedLabel={selected ? Strings.home.warehouse.item(selected) : "Nije odabrano"}
                    selectedHelperText={
                      selectedDoc
                        ? `${formatDocumentTitle(selectedDoc)}\n${formatDocumentDetails(selectedDoc)}`
                        : "Odaberi zadano skladište za ovu grupu."
                    }
                    onSelect={(id) => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      form.setWarehouseForStorageGroup(key, id);
                      setOpenGroupId(null);
                    }}
                    itemLabel={(id) => {
                      const doc = group.documents.find((d) => Number(d.warehouseId) === id);
                      return doc ? `${Strings.home.warehouse.item(id)} • ${formatDocumentTitle(doc)}` : Strings.home.warehouse.item(id);
                    }}
                    itemDescription={(id) => {
                      const doc = group.documents.find((d) => Number(d.warehouseId) === id);
                      return doc ? formatDocumentDetails(doc) : null;
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {!!form.errors.warehouseError ? <Text style={S.fieldErr}>{form.errors.warehouseError}</Text> : null}

          <Pressable
            onPress={form.submit}
            disabled={!form.canSubmit || form.submitting}
            style={({ pressed }) => [
              S.saveBtn,
              pressed && S.pressed,
              (!form.canSubmit || form.submitting) && S.disabled,
            ]}
          >
            {form.submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={S.saveText}>{Strings.settings.mainWarehouse.save}</Text>
            )}
          </Pressable>
        </View>
      </TabScroll>
    </Screen>
  );
}

function formatDocumentTitle(doc: DocumentDescriptorResponseDTO): string {
  const category = String(doc.storageGroupName ?? "").trim();
  const display = String(doc.displayName ?? "").trim();
  if (category && display && category !== display) return `${category} • ${display}`;
  return category || display || "Otprema";
}

function formatDocumentDetails(doc: DocumentDescriptorResponseDTO): string {
  const parts = [
    `Dokument #${formatOptionalNumber(doc.documentId)}`,
  ].filter(Boolean);

  return parts.join(" • ");
}

function formatDocumentGroupName(doc: DocumentDescriptorResponseDTO): string {
  const category = String(doc.storageGroupName ?? "").trim();
  if (category) return category;
  const display = String(doc.displayName ?? "").trim();
  return display || "Grupa dokumenta";
}

function buildDocumentGroups(docs: DocumentDescriptorResponseDTO[]) {
  const byGroup = new Map<string, {
    storageGroupId: string;
    name: string;
    documents: DocumentDescriptorResponseDTO[];
    warehouseIds: number[];
  }>();

  for (const doc of docs ?? []) {
    const rawGroupId = Number(doc.storageGroupId);
    const storageGroupId = Number.isFinite(rawGroupId) && rawGroupId > 0
      ? String(rawGroupId)
      : `doc-${doc.documentId}`;
    const warehouseId = Number(doc.warehouseId);
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) continue;

    const current = byGroup.get(storageGroupId) ?? {
      storageGroupId,
      name: formatDocumentGroupName(doc),
      documents: [],
      warehouseIds: [],
    };

    current.documents.push(doc);
    if (!current.warehouseIds.includes(warehouseId)) {
      current.warehouseIds.push(warehouseId);
    }
    byGroup.set(storageGroupId, current);
  }

  return Array.from(byGroup.values())
    .map((group) => ({
      ...group,
      documents: group.documents.sort((a, b) => Number(a.warehouseId) - Number(b.warehouseId)),
      warehouseIds: group.warehouseIds.sort((a, b) => a - b),
    }))
    .sort((a, b) => groupPriority(a.name) - groupPriority(b.name)
      || a.name.localeCompare(b.name, "hr", { sensitivity: "base" }));
}

function formatOptionalNumber(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "-";
}

function groupPriority(name: string): number {
  const normalized = name.toLocaleLowerCase("hr");
  if (normalized.includes("socijalna")) return 1;
  if (normalized.includes("donirana")) return 2;
  return 10;
}
