import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { toUserMessage } from "@/app/api/apiClient";
import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { documentDirectoryService } from "@/app/api/services/documentDirectoryService";

import type {
  DocumentDescriptorResponseDTO,
  TemplateDocResponseDTO,
  TemplateItemUpsertRequestDTO,
} from "@/app/models/generated";

import {
  useDeleteTemplateDoc,
  useReplaceTemplateDocItems,
  useTemplateDetail,
  useUpsertTemplateDoc,
} from "@/app/api/hooks/templates/useDispatchTemplates";

import { styles as s } from "../../styles/TemplateDocuments.styles";
import { TemplateDocItemsEditorModal } from "@/components/TemplateDocItemsEditorModal";
import { useItemDirectoryPickerPage } from "@/app/api/hooks/documents/useItemDirectoryPickerPage";

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

export default function TemplateDocumentsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();

  const templateId = useMemo(() => {
    const n = Number(params.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.id]);

  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId ?? null;

  const templateQ = useTemplateDetail(templateId, { includeItemMeta: true });
  const upsertDocM = useUpsertTemplateDoc();
  const replaceItemsM = useReplaceTemplateDocItems();
  const deleteDocM = useDeleteTemplateDoc();

  const { fetchItemsPage } = useItemDirectoryPickerPage({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    enabled: true,
  });

  const template = templateQ.data;
  const docs = useMemo(() => template?.documents ?? [], [template?.documents]);
  const excludeDocumentIds = useMemo(() => buildExcludeDocumentIds(docs), [docs]);

  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<TemplateDocResponseDTO | null>(null);
  const [draft, setDraft] = useState(true);
  const [note, setNote] = useState("");

  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsDoc, setItemsDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<TemplateDocResponseDTO | null>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

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

  const fetchDocTypesPage = useCallback(
    async ({ page, size, q }: { page: number; size: number; q?: string }) => {
      if (!warehouseId) {
        return { items: [] as DocumentDescriptorResponseDTO[], page, size, total: 0 };
      }

      const all = await documentDirectoryService.listDocTypesByCode({
        warehouseId,
        documentCode: "OTPREMNICA",
        q: q ?? undefined,
        excludeDocumentIds,
      });

      const needle = (q ?? "").trim().toLowerCase();

      const filtered = !needle
        ? all
        : all.filter((d) => {
          const a = (d.displayName ?? "").toLowerCase();
          const b = (d.documentCode ?? "").toLowerCase();
          const c = String(d.documentId ?? "");
          return a.includes(needle) || b.includes(needle) || c.includes(needle);
        });

      filtered.sort((a, b) =>
        (a.displayName ?? "").localeCompare(b.displayName ?? "", "hr", { sensitivity: "base" })
      );

      const start = page * size;
      const end = start + size;

      return {
        items: filtered.slice(start, end),
        page,
        size,
        total: filtered.length,
      };
    },
    [warehouseId, excludeDocumentIds]
  );

  if (ready && !warehouseId) {
    return (
      <Screen>
        <NavigationHeader
          title="Dokumenti"
          subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
          fallbackHref="/(tabs)/templates"
        />

        <View style={s.container}>
          <ErrorCard
            title="Nedostaje glavno skladište"
            message="U Postavkama prvo odaberi glavno skladište da bi mogao koristiti predloške."
            actionText="Zatvori"
            onAction={() => { }}
            titleLines={2}
            messageLines={3}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavigationHeader
        title="Dokumenti"
        subtitle={templateId ? `Predložak #${templateId}` : "Predložak"}
        fallbackHref="/(tabs)/templates"
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
              data={docs}
              keyExtractor={(d) => String(d.id)}
              contentContainerStyle={s.listContent}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={s.cardHeaderRow}>
                    <Text style={s.title}>Dokument #{item.documentId}</Text>
                    <Text style={s.sub}>{item.draft ? "Draft" : "Final"}</Text>
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
              )}
              ListEmptyComponent={<Text style={s.empty}>Nema dokumenata u predlošku.</Text>}
            />

            <SearchPickerSheet<DocumentDescriptorResponseDTO>
              visible={docPickerOpen}
              title="Odaberi dokument"
              onClose={() => setDocPickerOpen(false)}
              keyOf={(x) => String(x.documentId)}
              fetchPage={fetchDocTypesPage}
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
                          draft: true,
                          defaultNote: "",
                        } as any,
                      });

                      close();
                    } catch (e) {
                      setScreenError(toUserMessage(e, "Greška pri dodavanju dokumenta."));
                    }
                  }}
                >
                  <Text style={s.pickTitle}>{docType.displayName}</Text>
                  <Text style={s.pickSub}>
                    Šifra: {docType.documentCode} • ID: {docType.documentId}
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
              initialItems={itemsDoc?.items ?? []}
              loading={replaceItemsM.isPending}
              onClose={() => {
                if (replaceItemsM.isPending) return;
                setItemsOpen(false);
                setItemsDoc(null);
              }}
              onSave={saveDocItems}
              fetchItemsPage={fetchItemsPage}
            />

            <CenterConfirmSheet
              visible={deleteOpen}
              title="Obrisati dokument?"
              description={
                deleteDoc
                  ? `Dokument #${deleteDoc.documentId}\nObrisat će se i sve stavke dokumenta iz predloška.`
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