import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { toUserMessage } from "../../../../../src/api/apiClient";
import { documentDirectoryService } from "../../../../../src/api/services/documentDirectoryService";
import { itemDirectoryService } from "../../../../../src/api/services/itemDirectoryService";

import type {
  DocumentDescriptorResponseDTO,
  TemplateDocResponseDTO,
  TemplateItemUpsertRequestDTO,
} from "@/src/models/generated";

import {
  useDeleteTemplateDoc,
  useReplaceTemplateDocItems,
  useTemplateDetail,
  useUpsertTemplateDoc,
} from "../../../../../src/api/hooks/templates/useDispatchTemplates";

import { styles as s } from "../../../../../src/styles/TemplateDocuments.styles";
import { TemplateDocItemsEditorModal } from "@/components/TemplateDocItemsEditorModal";

type LockedCenterModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  disableClose?: boolean;
  children: React.ReactNode;
};

function LockedCenterModal(props: LockedCenterModalProps) {
  const { visible, title, onClose, disableClose, children } = props;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={disableClose ? undefined : onClose}
    >
      <View style={s.modalWrap}>
        <View style={s.backdrop} />

        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>

            <Pressable
              style={[s.iconBtn, disableClose && s.disabled]}
              disabled={disableClose}
              onPress={disableClose ? undefined : onClose}
            >
              <FontAwesome name="close" size={18} color="#0f172a" />
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

function buildExcludeDocumentIds(templateDocs?: TemplateDocResponseDTO[] | null): number[] {
  const set = new Set<number>();

  for (const d of templateDocs ?? []) {
    const id = Number(d?.documentId);
    if (Number.isFinite(id) && id > 0) set.add(id);
  }

  return Array.from(set);
}

function descriptorForDocument(
  documentId: number | null | undefined,
  descriptors: Map<number, DocumentDescriptorResponseDTO>
): DocumentDescriptorResponseDTO | null {
  const id = Number(documentId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return descriptors.get(id) ?? null;
}

function documentTitle(documentId: number | null | undefined, descriptor?: DocumentDescriptorResponseDTO | null): string {
  const id = Number(documentId);
  const display = String(descriptor?.displayName ?? "").trim();
  const group = String(descriptor?.storageGroupName ?? "").trim();

  if (group && display && group !== display) return `${group} • ${display}`;
  if (group || display) return group || display;
  return Number.isFinite(id) && id > 0 ? `Dokument #${id}` : "Dokument";
}

function documentSubtitle(documentId: number | null | undefined, descriptor?: DocumentDescriptorResponseDTO | null): string {
  const id = Number(documentId);
  const parts = [
    descriptor?.documentCode ? `Šifra: ${descriptor.documentCode}` : null,
    Number.isFinite(id) && id > 0 ? `Dokument #${id}` : null,
    descriptor?.warehouseId ? `Skladište #${descriptor.warehouseId}` : null,
  ].filter(Boolean);

  return parts.join(" • ");
}

function documentGroupRank(descriptor?: DocumentDescriptorResponseDTO | null): number {
  const text = `${descriptor?.storageGroupName ?? ""} ${descriptor?.displayName ?? ""}`.toLowerCase();
  if (text.includes("socijalna")) return 0;
  if (text.includes("doniran")) return 1;
  return 2;
}

function compareDescriptors(a?: DocumentDescriptorResponseDTO | null, b?: DocumentDescriptorResponseDTO | null): number {
  const rank = documentGroupRank(a) - documentGroupRank(b);
  if (rank !== 0) return rank;

  const name = String(a?.storageGroupName ?? a?.displayName ?? "").localeCompare(
    String(b?.storageGroupName ?? b?.displayName ?? ""),
    "hr",
    { sensitivity: "base" }
  );
  if (name !== 0) return name;

  const aw = Number(a?.warehouseId ?? 0);
  const bw = Number(b?.warehouseId ?? 0);
  if (aw !== bw) return aw - bw;

  return Number(a?.documentId ?? 0) - Number(b?.documentId ?? 0);
}

function compareTemplateDocs(
  a: TemplateDocResponseDTO,
  b: TemplateDocResponseDTO,
  descriptors: Map<number, DocumentDescriptorResponseDTO>
): number {
  const ad = descriptorForDocument(a.documentId, descriptors);
  const bd = descriptorForDocument(b.documentId, descriptors);
  const descriptorOrder = compareDescriptors(ad, bd);
  if (descriptorOrder !== 0) return descriptorOrder;

  const sortOrder = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
  if (sortOrder !== 0) return sortOrder;

  return Number(a.documentId ?? 0) - Number(b.documentId ?? 0);
}

export default function TemplateDocumentsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();

  const templateId = useMemo(() => {
    const n = Number(params.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id]);

  const templateQ = useTemplateDetail(templateId, { includeItemMeta: true });
  const upsertDocM = useUpsertTemplateDoc();
  const replaceItemsM = useReplaceTemplateDocItems();
  const deleteDocM = useDeleteTemplateDoc();

  const backHref = useMemo(() => {
    if (!templateId) {
      return "/(tabs)/templates" as const;
    }

    return {
      pathname: "/(tabs)/templates/template/[id]" as const,
      params: { id: String(templateId) },
    };
  }, [templateId]);

  const template = templateQ.data;
  const rawDocs = useMemo(() => template?.documents ?? [], [template?.documents]);

  const documentDescriptorsQ = useQuery({
    queryKey: ["template-documents", "document-descriptors", "ALL_OTPREMNICA_GROUPS"],
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

  const documentDescriptorById = useMemo(() => {
    const map = new Map<number, DocumentDescriptorResponseDTO>();
    for (const doc of (documentDescriptorsQ.data ?? []) as DocumentDescriptorResponseDTO[]) {
      const id = Number(doc.documentId);
      if (Number.isFinite(id) && id > 0) map.set(id, doc);
    }
    return map;
  }, [documentDescriptorsQ.data]);

  const docs = useMemo(
    () => rawDocs.slice().sort((a, b) => compareTemplateDocs(a, b, documentDescriptorById)),
    [rawDocs, documentDescriptorById]
  );

  const excludeDocumentIds = useMemo(() => buildExcludeDocumentIds(docs), [docs]);

  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<TemplateDocResponseDTO | null>(null);
  const [draft, setDraft] = useState(false);
  const [note, setNote] = useState("");

  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsDoc, setItemsDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  const fetchItemsPageForItemsDoc = useCallback(
    async (args: { page: number; size: number; q?: string }) => {
      const descriptor = descriptorForDocument(itemsDoc?.documentId, documentDescriptorById);
      const targetWarehouseId = Number((descriptor as any)?.warehouseId ?? 0);

      if (!targetWarehouseId) {
        return {
          items: [],
          page: args.page,
          size: args.size,
          total: 0,
        };
      }

      return itemDirectoryService.pageItems({
        warehouseId: targetWarehouseId,
        page: args.page,
        size: args.size,
        q: args.q,
      });
    },
    [itemsDoc?.documentId, documentDescriptorById]
  );

  const resetTransientErrors = useCallback(() => {
    setScreenError(null);
    setDismissedTopError(null);
    upsertDocM.reset();
    replaceItemsM.reset();
    deleteDocM.reset();
  }, [upsertDocM, replaceItemsM, deleteDocM]);

  const rawTopError =
    screenError ||
    (upsertDocM.error ? toUserMessage(upsertDocM.error, "Greška pri spremanju dokumenta.") : null) ||
    (deleteDocM.error ? toUserMessage(deleteDocM.error, "Greška pri brisanju dokumenta.") : null) ||
    templateQ.errorMessage ||
    (!templateId ? "Neispravan ID predloška." : null);

  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  const closeTopError = useCallback(() => {
    const currentRaw =
      screenError ||
      (upsertDocM.error ? toUserMessage(upsertDocM.error, "Greška pri spremanju dokumenta.") : null) ||
      (deleteDocM.error ? toUserMessage(deleteDocM.error, "Greška pri brisanju dokumenta.") : null) ||
      templateQ.errorMessage ||
      (!templateId ? "Neispravan ID predloška." : null);

    setScreenError(null);
    upsertDocM.reset();
    deleteDocM.reset();
    setDismissedTopError(currentRaw ?? null);
  }, [screenError, upsertDocM, deleteDocM, templateQ.errorMessage, templateId]);

  const openEditDoc = useCallback(
    (doc: TemplateDocResponseDTO) => {
      resetTransientErrors();
      setEditDoc(doc);
      setDraft(!!doc.draft);
      setNote(doc.defaultNote ?? "");
      setEditOpen(true);
    },
    [resetTransientErrors]
  );

  const openItemsEditor = useCallback(
    (doc: TemplateDocResponseDTO) => {
      resetTransientErrors();
      setItemsDoc(doc);
      setItemsOpen(true);
    },
    [resetTransientErrors]
  );

  const openDeleteConfirm = useCallback(
    (doc: TemplateDocResponseDTO) => {
      resetTransientErrors();
      setDeleteDoc(doc);
      setDeleteOpen(true);
    },
    [resetTransientErrors]
  );

  const saveDocMeta = useCallback(async () => {
    if (!templateId || !editDoc) return;

    try {
      resetTransientErrors();

      await upsertDocM.mutateAsync({
        templateId,
        payload: {
          documentId: editDoc.documentId,
          sortOrder: editDoc.sortOrder ?? 1,
          draft,
          defaultNote: note,
        } as any,
      });

      setEditOpen(false);
      setEditDoc(null);
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri spremanju dokumenta."));
    }
  }, [templateId, editDoc, draft, note, upsertDocM, resetTransientErrors]);

  const confirmDeleteDoc = useCallback(async () => {
    if (!templateId || !deleteDoc) return;

    try {
      resetTransientErrors();

      await deleteDocM.mutateAsync({
        templateId,
        templateDocId: deleteDoc.id,
      });

      setDeleteOpen(false);
      setDeleteDoc(null);
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri brisanju dokumenta."));
    }
  }, [templateId, deleteDoc, deleteDocM, resetTransientErrors]);

  const saveDocItems = useCallback(
    async (items: TemplateItemUpsertRequestDTO[]) => {
      if (!templateId || !itemsDoc) return;

      replaceItemsM.reset();

      await replaceItemsM.mutateAsync({
        templateId,
        templateDocId: itemsDoc.id,
        items,
      });

      setItemsOpen(false);
      setItemsDoc(null);
    },
    [templateId, itemsDoc, replaceItemsM]
  );

  const docPickerKey = useMemo(
    () =>
      [
        "template-documents",
        "document-picker",
        templateId ?? "NO_TEMPLATE",
        excludeDocumentIds.join(","),
      ] as const,
    [templateId, excludeDocumentIds]
  );

  const queryDocTypesPage = useCallback(
    async ({
      page,
      size,
      q,
      signal,
    }: {
      page: number;
      size: number;
      q?: string;
      signal?: AbortSignal;
    }) => {
      const all = await documentDirectoryService.listDocTypesByCode(
        {
          documentCode: "OTPREMNICA",
          q: q ?? undefined,
          excludeDocumentIds,
        },
        signal
      );

      const needle = (q ?? "").trim().toLowerCase();

      const filtered = !needle
        ? all
        : all.filter((d) => {
          const a = (d.displayName ?? "").toLowerCase();
          const b = (d.documentCode ?? "").toLowerCase();
          const c = String(d.documentId ?? "");
          const group = String((d as any).storageGroupName ?? "").toLowerCase();
          return a.includes(needle) || b.includes(needle) || c.includes(needle) || group.includes(needle);
        });

      filtered.sort(compareDescriptors);

      const start = page * size;
      const end = start + size;

      return {
        items: filtered.slice(start, end),
        page,
        size,
        total: filtered.length,
      };
    },
    [excludeDocumentIds]
  );

  return (
    <Screen>
      <NavigationHeader
        title="Dokumenti"
        subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
        fallbackHref={backHref}
      />

      <View style={s.container}>
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

        {!template ? (
          <Text style={s.loading}>{templateQ.isLoading ? "Učitavam…" : "Predložak nije pronađen."}</Text>
        ) : (
          <>
            <Pressable
              style={[s.primary, (!templateId || upsertDocM.isPending) && s.disabled]}
              disabled={!templateId || upsertDocM.isPending}
              onPress={() => {
                resetTransientErrors();
                setDocPickerOpen(true);
              }}
            >
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.primaryText}>Dodaj dokument</Text>
            </Pressable>

            <FlatList
              style={s.list}
              data={docs}
              keyExtractor={(d) => String(d.id)}
              contentContainerStyle={s.listContent}
              renderItem={({ item }) => {
                const descriptor = descriptorForDocument(item.documentId, documentDescriptorById);
                return (
                  <View style={s.card}>
                    <View style={s.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.title}>{documentTitle(item.documentId, descriptor)}</Text>
                        <Text style={s.desc} numberOfLines={2}>
                          {documentSubtitle(item.documentId, descriptor)}
                        </Text>
                      </View>
                      <Text style={s.sub}>{item.draft ? "Draft: DA" : "Draft: NE"}</Text>
                    </View>

                    {!!item.defaultNote && (
                      <Text style={s.desc} numberOfLines={2}>
                        Napomena: {item.defaultNote}
                      </Text>
                    )}

                    <Text style={s.desc}>Stavki: {item.items?.length ?? 0}</Text>

                    <View style={s.actionsRow}>
                      <Pressable style={s.actionBtn} onPress={() => openEditDoc(item)}>
                        <Text style={s.actionText}>Uredi</Text>
                      </Pressable>

                      <Pressable style={s.actionBtn} onPress={() => openItemsEditor(item)}>
                        <Text style={s.actionText}>Stavke</Text>
                      </Pressable>

                      <Pressable
                        style={[s.actionBtn, s.actionDangerBtn, deleteDocM.isPending && s.disabled]}
                        disabled={deleteDocM.isPending}
                        onPress={() => openDeleteConfirm(item)}
                      >
                        <Text style={[s.actionText, s.actionDangerText]}>
                          {deleteDocM.isPending ? "…" : "Obriši"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={s.empty}>Nema dokumenata u predlošku.</Text>}
            />

            <SearchPickerSheet<DocumentDescriptorResponseDTO>
              visible={docPickerOpen}
              title="Odaberi dokument"
              onClose={() => setDocPickerOpen(false)}
              keyOf={(x) => String(x.documentId)}
              queryKeyBase={docPickerKey}
              queryPage={queryDocTypesPage}
              staleTime={16 * 60 * 60 * 1000}
              gcTime={24 * 60 * 60 * 1000}
              renderRow={(docType, close) => (
                <Pressable
                  style={s.pickRow}
                  onPress={async () => {
                    try {
                      if (!templateId) return;

                      resetTransientErrors();

                      await upsertDocM.mutateAsync({
                        templateId,
                        payload: {
                          documentId: docType.documentId,
                          sortOrder: docs.length + 1,
                          draft: false,
                          defaultNote: "",
                        } as any,
                      });

                      close();
                    } catch (e) {
                      setScreenError(toUserMessage(e, "Greška pri dodavanju dokumenta."));
                    }
                  }}
                >
                  <Text style={s.pickTitle}>
                    {documentTitle(docType.documentId, docType)}
                  </Text>
                  <Text style={s.pickSub}>
                    {documentSubtitle(docType.documentId, docType)}
                  </Text>
                </Pressable>
              )}
            />

            <LockedCenterModal
              visible={editOpen}
              title="Uredi dokument"
              disableClose={upsertDocM.isPending}
              onClose={() => {
                if (upsertDocM.isPending) return;
                setEditOpen(false);
                setEditDoc(null);
              }}
            >
              <View style={s.centerBlock}>
                <Pressable
                  style={s.toggle}
                  onPress={() => {
                    resetTransientErrors();
                    setDraft((v) => !v);
                  }}
                >
                  <Text style={s.toggleText}>{draft ? "Draft: DA" : "Draft: NE"}</Text>
                </Pressable>

                <View style={s.fieldBlock}>
                  <Text style={s.helperTitle}>Zadana napomena</Text>
                  <TextInput
                    value={note}
                    onChangeText={(v) => {
                      resetTransientErrors();
                      setNote(v);
                    }}
                    placeholder="Upiši napomenu (opcionalno)…"
                    placeholderTextColor="rgba(148,163,184,0.85)"
                    style={s.input}
                  />
                </View>

                <Pressable
                  style={[s.primary, upsertDocM.isPending && s.disabled]}
                  disabled={upsertDocM.isPending}
                  onPress={saveDocMeta}
                >
                  <Text style={s.primaryText}>{upsertDocM.isPending ? "Spremam…" : "Spremi"}</Text>
                </Pressable>

                <Pressable
                  style={s.btnWide}
                  disabled={upsertDocM.isPending}
                  onPress={() => {
                    if (upsertDocM.isPending) return;
                    setEditOpen(false);
                    setEditDoc(null);
                  }}
                >
                  <Text style={s.btnText}>Zatvori</Text>
                </Pressable>
              </View>
            </LockedCenterModal>

            <TemplateDocItemsEditorModal
              visible={itemsOpen}
              title="Stavke dokumenta"
              documentId={itemsDoc?.documentId ?? null}
              documentLabel={documentTitle(
                itemsDoc?.documentId ?? null,
                descriptorForDocument(itemsDoc?.documentId, documentDescriptorById)
              )}
              documentSubtitle={documentSubtitle(
                itemsDoc?.documentId ?? null,
                descriptorForDocument(itemsDoc?.documentId, documentDescriptorById)
              )}
              initialItems={itemsDoc?.items ?? []}
              loading={replaceItemsM.isPending}
              onClose={() => {
                if (replaceItemsM.isPending) return;
                setItemsOpen(false);
                setItemsDoc(null);
              }}
              onSave={saveDocItems}
              fetchItemsPage={fetchItemsPageForItemsDoc}
            />

            <CenterConfirmSheet
              visible={deleteOpen}
              title="Obrisati dokument?"
              description={
                deleteDoc
                  ? `${documentTitle(deleteDoc.documentId, descriptorForDocument(deleteDoc.documentId, documentDescriptorById))}\nObrisat će se i sve stavke dokumenta iz predloška.`
                  : ""
              }
              confirmText="Obriši"
              danger
              loading={deleteDocM.isPending}
              onClose={() => {
                if (deleteDocM.isPending) return;
                setDeleteOpen(false);
                setDeleteDoc(null);
              }}
              onConfirm={confirmDeleteDoc}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
