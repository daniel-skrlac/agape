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
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { Banner } from "@/components/Banner";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import Colors from "@/constants/Colors";
import TemplatesHeader from "../../TemplatesHeader";

import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { useTemplate, useUpsertDoc, useReplaceItems, useDeleteDoc } from "@/app/api/hooks/useDispatchTemplates";
import { documentDirectoryService } from "@/app/api/services/documentDirectoryService";
import { useItemsPage } from "@/app/api/hooks/useItemDirectory";

import type {
  DocumentDescriptorResponseDTO,
  TemplateDocResponseDTO,
  TemplateItemResponseDTO,
  TemplateItemUpsertRequestDTO,
  ItemDescriptorResponseDTO,
} from "@/app/models/generated";

const MAX_W = 560;
const ITEMS_PAGE_SIZE = 10;

// A bit darker so placeholders are visible even on light bg
const PLACEHOLDER = "rgba(148,163,184,0.85)";

type UiTemplateItem = TemplateItemResponseDTO & {
  meta?: ItemDescriptorResponseDTO;
};

type LocalDoc = Omit<TemplateDocResponseDTO, "items"> & {
  items: UiTemplateItem[];
};

function normalizeCode(code: any): string {
  const c = (code ?? "").toString().trim();
  return c ? c.toUpperCase() : "";
}

function buildExcludeDocumentIdsFromTemplateDocs(templateDocs: any[] | null | undefined): number[] {
  const set = new Set<number>();
  for (const d of templateDocs ?? []) {
    const id = Number(d?.documentId);
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return Array.from(set);
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

export default function Dokumenti() {
  const params = useLocalSearchParams<{ id: string }>();
  const templateId = Number(params.id);

  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId ?? null;

  const DOC_CODE = "OTPREMNICA";

  // Hard block if main warehouse is missing
  if (ready && !warehouseId) {
    return (
      <Screen>
        <TemplatesHeader title="Dokumenti" subtitle={`Predložak #${templateId}`} fallbackHref="/(tabs)/templates" />
        <View style={s.container}>
          <Banner
            type="error"
            text="Nema odabranog glavnog skladišta. U Postavkama prvo odaberi glavno skladište da bi mogao koristiti Predloške."
          />
          <Pressable style={s.primary} onPress={() => router.push("/(tabs)/settings")}>
            <FontAwesome name="cog" size={14} color="#fff" />
            <Text style={s.primaryText}>Otvori postavke</Text>
          </Pressable>
          <Pressable style={[s.btnWide, { marginTop: 6 }]} onPress={() => router.back()}>
            <Text style={s.btnText}>Natrag</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const tQ = useTemplate(templateId);
  const upsertDocM = useUpsertDoc();
  const replaceItemsM = useReplaceItems();
  const deleteDocM = useDeleteDoc();

  const t = tQ.data;

  const excludeDocumentIds = useMemo(
    () => buildExcludeDocumentIdsFromTemplateDocs(t?.documents as any),
    [t?.documents]
  );


  // show only OTPREMNICA docs if code exists on object
  const docs = useMemo(() => {
    const all = t?.documents ?? [];
    return all;
  }, [t?.documents]);

  // global error banner (mutations + template)
  const err =
    (tQ.error as any)?.message ||
    (upsertDocM.error as any)?.message ||
    (replaceItemsM.error as any)?.message ||
    (deleteDocM.error as any)?.message ||
    null;

  // DOC PICKER
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  // EDIT DOC (center)
  const [editOpen, setEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<TemplateDocResponseDTO | null>(null);
  const [draft, setDraft] = useState(true);
  const [note, setNote] = useState("");

  // ITEMS (center)
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsDoc, setItemsDoc] = useState<LocalDoc | null>(null);

  // items UX tab: results vs added
  const [itemsTab, setItemsTab] = useState<"results" | "added">("results");

  // item search state (inside items modal)
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [itemsPage, setItemsPage] = useState(0);

  useEffect(() => {
    const tt = setTimeout(() => setDebouncedQ(searchQ.trim()), 250);
    return () => clearTimeout(tt);
  }, [searchQ]);

  useEffect(() => {
    setItemsPage(0);
  }, [debouncedQ]);

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

  // DELETE CONFIRM
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<TemplateDocResponseDTO | null>(null);

  const openEdit = (d: TemplateDocResponseDTO) => {
    setEditDoc(d);
    setDraft(!!d.draft);
    setNote(d.defaultNote ?? "");
    setEditOpen(true);
  };

  const openItems = (d: TemplateDocResponseDTO) => {
    // local copy (user can play with items until Save)
    const local: LocalDoc = {
      ...(d as any),
      items: (d.items ?? []).map((x) => ({ ...x })) as UiTemplateItem[],
    };

    setItemsDoc(local);
    setItemsOpen(true);

    // reset UX
    setItemsTab("results");
    setSearchQ("");
    setDebouncedQ("");
    setItemsPage(0);
  };

  const openDelete = (d: TemplateDocResponseDTO) => {
    setDeleteDoc(d);
    setDeleteOpen(true);
  };

  const saveDocMeta = async () => {
    if (!editDoc) return;

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
    tQ.refetch();
  };

  // ---------- Items UX: quick add + edit qty ----------
  // IMPORTANT: use functional setState to prevent duplicates on fast taps
  const addOne = (meta: ItemDescriptorResponseDTO) => {
    setItemsDoc((prev) => {
      if (!prev) return prev;

      const list = [...(prev.items ?? [])];
      const idx = list.findIndex((x) => Number(x.itemId) === Number(meta.itemId));

      if (idx >= 0) {
        const cur = list[idx];
        const curQty = Number(cur.quantity ?? 0);
        list[idx] = {
          ...cur,
          quantity: (Number.isFinite(curQty) ? curQty : 0) + 1,
          meta: cur.meta ?? meta,
        };
      } else {
        list.push({
          itemId: meta.itemId,
          quantity: 1,
          sortOrder: list.length + 1,
          meta,
        });
      }

      const fixed = list.map((x, i) => ({ ...x, sortOrder: i + 1 }));
      return { ...prev, items: fixed };
    });

    // make it obvious the item was added
    setItemsTab("added");
  };

  const setQtyFor = (itemId: number, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) return;

    setItemsDoc((prev) => {
      if (!prev) return prev;
      const list = [...prev.items];
      const idx = list.findIndex((x) => Number(x.itemId) === Number(itemId));
      if (idx < 0) return prev;
      list[idx] = { ...list[idx], quantity: qty };
      return { ...prev, items: list };
    });
  };

  const bumpQty = (itemId: number, delta: number) => {
    setItemsDoc((prev) => {
      if (!prev) return prev;
      const list = [...prev.items];
      const idx = list.findIndex((x) => Number(x.itemId) === Number(itemId));
      if (idx < 0) return prev;

      const cur = Number(list[idx].quantity ?? 0);
      const next = cur + delta;
      if (!Number.isFinite(next) || next <= 0) return prev;

      list[idx] = { ...list[idx], quantity: next };
      return { ...prev, items: list };
    });
  };

  const removeItem = (itemId: number) => {
    setItemsDoc((prev) => {
      if (!prev) return prev;
      const list = [...prev.items].filter((x) => Number(x.itemId) !== Number(itemId));
      const fixed = list.map((x, i) => ({ ...x, sortOrder: i + 1 }));
      return { ...prev, items: fixed };
    });
  };

  const saveItems = async () => {
    if (!itemsDoc) return;

    const payload: TemplateItemUpsertRequestDTO[] = itemsDoc.items.map((x, i) => ({
      itemId: x.itemId,
      quantity: x.quantity,
      sortOrder: i + 1,
    }));

    await replaceItemsM.mutateAsync({
      templateId,
      docId: itemsDoc.id,
      items: payload as any,
    });

    setItemsOpen(false);
    setItemsDoc(null);
    tQ.refetch();
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;

    await deleteDocM.mutateAsync({ templateId, templateDocId: deleteDoc.id } as any);
    setDeleteOpen(false);
    setDeleteDoc(null);
    tQ.refetch();
  };

  // DOCUMENT TYPES paging (local)
  const fetchDocTypesPage = async ({ page, size, q }: { page: number; size: number; q?: string }) => {
    if (!warehouseId) return { items: [] as DocumentDescriptorResponseDTO[], page, size, total: 0 };

    try {
      const all = await documentDirectoryService.listDocTypesByCode({
        warehouseId,
        documentCode: DOC_CODE,
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

      filtered.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", "hr", { sensitivity: "base" }));

      const start = page * size;
      const end = start + size;
      return { items: filtered.slice(start, end), page, size, total: filtered.length };
    } catch {
      return { items: [] as DocumentDescriptorResponseDTO[], page, size, total: 0 };
    }
  };


  return (
    <Screen>
      <TemplatesHeader title="Dokumenti" subtitle={`Predložak #${templateId}`} fallbackHref="/(tabs)/templates" />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <Pressable style={s.primary} onPress={() => setDocPickerOpen(true)}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.primaryText}>Dodaj dokument</Text>
            </Pressable>

            <FlatList
              data={docs}
              keyExtractor={(d) => String(d.id)}
              contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={s.title}>Dokument #{item.documentId}</Text>
                    <Text style={s.sub}>{item.draft ? "Skica" : "Konačno"}</Text>
                  </View>

                  {!!item.defaultNote && (
                    <Text style={s.desc} numberOfLines={2}>
                      Napomena: {item.defaultNote}
                    </Text>
                  )}

                  {/* ✅ per your request: ONLY show number of items on the main view */}
                  <Text style={s.desc}>Stavki: {item.items?.length ?? 0}</Text>

                  <View style={s.actionsRow}>
                    <Pressable style={s.actionBtn} onPress={() => openEdit(item)}>
                      <Text style={s.actionText}>Uredi</Text>
                    </Pressable>
                    <Pressable style={s.actionBtn} onPress={() => openItems(item)}>
                      <Text style={s.actionText}>Stavke</Text>
                    </Pressable>
                    <Pressable
                      style={[s.actionBtn, { backgroundColor: Colors.dangerBg }]}
                      onPress={() => openDelete(item)}
                      disabled={deleteDocM.isPending}
                    >
                      <Text style={[s.actionText, { color: Colors.dangerText }]}>
                        {deleteDocM.isPending ? "…" : "Obriši"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={s.empty}>Nema dokumenata u predlošku.</Text>}
            />

            {/* PICK DOCUMENT TYPE */}
            <SearchPickerSheet<DocumentDescriptorResponseDTO>
              visible={docPickerOpen}
              title="Odaberi dokument"
              onClose={() => setDocPickerOpen(false)}
              keyOf={(x) => String(x.documentId)}
              fetchPage={fetchDocTypesPage}
              renderRow={(d, close) => (
                <Pressable
                  style={s.pickRow}
                  onPress={async () => {
                    try {
                      const sortOrder = docs.length + 1;

                      await upsertDocM.mutateAsync({
                        templateId,
                        payload: {
                          documentId: d.documentId,
                          sortOrder,
                          draft: true,
                          defaultNote: "",
                        } as any,
                      });

                      close();
                      tQ.refetch();
                    } catch {
                      // error shown in banner
                    }
                  }}
                >
                  <Text style={s.pickTitle}>{d.displayName}</Text>
                  <Text style={s.pickSub}>
                    Šifra: {d.documentCode} • ID: {d.documentId} • Skladište: {warehouseId}
                  </Text>
                </Pressable>
              )}
            />

            {/* EDIT DOC — CENTER */}
            <CenterModal
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
                <Pressable style={s.toggle} onPress={() => setDraft((v) => !v)}>
                  <Text style={s.toggleText}>{draft ? "Skica: DA" : "Skica: NE"}</Text>
                </Pressable>

                <View style={{ width: "100%", maxWidth: MAX_W, gap: 6 }}>
                  <Text style={s.helperTitle}>Zadana napomena:</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Upiši napomenu (opcionalno)…"
                    placeholderTextColor={PLACEHOLDER}
                    style={s.input}
                  />
                </View>

                <Pressable
                  style={[s.primary, upsertDocM.isPending && { opacity: 0.6 }]}
                  disabled={upsertDocM.isPending}
                  onPress={saveDocMeta}
                >
                  <Text style={s.primaryText}>Spremi</Text>
                </Pressable>

                <Pressable
                  style={s.btnWide}
                  onPress={() => {
                    if (upsertDocM.isPending) return;
                    setEditOpen(false);
                    setEditDoc(null);
                  }}
                  disabled={upsertDocM.isPending}
                >
                  <Text style={s.btnText}>Zatvori</Text>
                </Pressable>
              </View>
            </CenterModal>

            {/* ITEMS — CENTER */}
            <CenterModal
              visible={itemsOpen}
              title="Stavke dokumenta"
              disableClose={replaceItemsM.isPending}
              onClose={() => {
                if (replaceItemsM.isPending) return;
                setItemsOpen(false);
                setItemsDoc(null);
              }}
            >
              {!itemsDoc ? null : (
                <View style={s.centerBlock}>
                  <Text style={s.sheetTitle}>Dokument #{itemsDoc.documentId}</Text>

                  {/* Tabs */}
                  <View style={s.tabs}>
                    <Pressable
                      style={[s.tabBtn, itemsTab === "results" && s.tabBtnActive]}
                      onPress={() => setItemsTab("results")}
                    >
                      <Text style={[s.tabText, itemsTab === "results" && s.tabTextActive]}>Rezultati</Text>
                    </Pressable>
                    <Pressable
                      style={[s.tabBtn, itemsTab === "added" && s.tabBtnActive]}
                      onPress={() => setItemsTab("added")}
                    >
                      <Text style={[s.tabText, itemsTab === "added" && s.tabTextActive]}>
                        Dodano ({itemsDoc.items.length})
                      </Text>
                    </Pressable>
                  </View>

                  {itemsTab === "results" ? (
                    <>
                      {/* search */}
                      <TextInput
                        value={searchQ}
                        onChangeText={setSearchQ}
                        placeholder="Pretraži artikle (naziv, šifra, ID)…"
                        placeholderTextColor={PLACEHOLDER}
                        style={s.input}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />

                      {!!itemsQ.error && (
                        <Banner type="error" text={(itemsQ.error as any)?.message ?? "Greška pri dohvaćanju artikala."} />
                      )}

                      {/* results */}
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
                              <View key={String(it.itemId)} style={s.resultRow}>
                                <View style={{ flex: 1 }}>
                                  {/* ✅ NAME FIRST + bold */}
                                  <Text style={s.itemNameStrong} numberOfLines={2}>
                                    {it.name?.trim() ? it.name : `Artikl #${it.itemId}`}
                                  </Text>

                                  {/* ✅ IDs still shown, but secondary */}
                                  <Text style={s.itemMeta}>
                                    {[
                                      it.code ? `Šifra: ${it.code}` : null,
                                      `ID: ${it.itemId}`,
                                      it.unit ? `JMJ: ${it.unit}` : null,
                                      it.barcode ? `Barkod: ${it.barcode}` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </Text>
                                </View>

                                <Pressable style={s.addBtn} onPress={() => addOne(it)} disabled={replaceItemsM.isPending}>
                                  <Text style={s.addBtnText}>+1</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* pager */}
                        <View style={s.pager}>
                          <Pressable
                            style={[s.pagerBtn, !canPrev && { opacity: 0.4 }]}
                            disabled={!canPrev}
                            onPress={() => setItemsPage((p) => Math.max(0, p - 1))}
                          >
                            <FontAwesome name="chevron-left" size={14} color={Colors.text} />
                          </Pressable>

                          <Text style={s.pagerText}>
                            Str. {itemsPage + 1} / {itemsTotalPages}
                          </Text>

                          <Pressable
                            style={[s.pagerBtn, !canNext && { opacity: 0.4 }]}
                            disabled={!canNext}
                            onPress={() => setItemsPage((p) => p + 1)}
                          >
                            <FontAwesome name="chevron-right" size={14} color={Colors.text} />
                          </Pressable>
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={s.block}>
                      <Text style={s.blockTitle}>Dodane stavke</Text>

                      {itemsDoc.items.length === 0 ? (
                        <Text style={s.muted}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>
                      ) : (
                        <View style={{ gap: 10, alignSelf: "stretch" }}>
                          {itemsDoc.items
                            .slice()
                            .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
                            .map((x) => {
                              const name = x.meta?.name?.trim() ? x.meta.name : `Artikl #${x.itemId}`;
                              const code = x.meta?.code ? `Šifra: ${x.meta.code}` : null;

                              return (
                                <View key={String(x.itemId)} style={s.itemRow}>
                                  <View style={{ flex: 1 }}>
                                    {/* ✅ NAME FIRST + bold */}
                                    <Text style={s.itemNameStrong} numberOfLines={2}>
                                      {name}
                                    </Text>

                                    {/* ✅ metadata / IDs secondary */}
                                    <Text style={s.itemMeta}>
                                      {[code, `ID: ${x.itemId}`, `Količina: ${x.quantity}`].filter(Boolean).join(" • ")}
                                    </Text>
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

                  <Pressable
                    style={[s.primary, replaceItemsM.isPending && { opacity: 0.6 }]}
                    disabled={replaceItemsM.isPending}
                    onPress={saveItems}
                  >
                    <Text style={s.primaryText}>Spremi stavke</Text>
                  </Pressable>

                  <Pressable
                    style={s.btnWide}
                    onPress={() => {
                      if (replaceItemsM.isPending) return;
                      setItemsOpen(false);
                      setItemsDoc(null);
                    }}
                    disabled={replaceItemsM.isPending}
                  >
                    <Text style={s.btnText}>Zatvori</Text>
                  </Pressable>
                </View>
              )}
            </CenterModal>

            {/* DELETE CONFIRM */}
            <CenterConfirmSheet
              visible={deleteOpen}
              title="Obrisati dokument?"
              description={
                deleteDoc ? `Dokument #${deleteDoc.documentId}\nObrisat će se i sve stavke dokumenta iz predloška.` : ""
              }
              confirmText="Obriši"
              danger
              loading={deleteDocM.isPending}
              onClose={() => {
                if (deleteDocM.isPending) return;
                setDeleteOpen(false);
                setDeleteDoc(null);
              }}
              onConfirm={confirmDelete}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  sub: { color: Colors.sub, fontWeight: "800" },
  desc: { color: Colors.sub, fontWeight: "700" },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontWeight: "900", color: Colors.text },

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

  pickRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    gap: 4,
  },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "700" },

  // center modal
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
  modalBody: {
    padding: 14,
    gap: 12,
    paddingBottom: 20,
  },

  centerBlock: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 12, alignItems: "center" },

  toggle: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontWeight: "900", color: Colors.text },

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

  sheetTitle: { fontWeight: "900", color: Colors.text, textAlign: "center" },

  block: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 10 },
  blockTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
  muted: { color: Colors.sub, fontWeight: "700" },

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

  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
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

  // ✅ NAME FIRST (strong) + meta secondary
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
  qtyInput: {
    width: 58,
    textAlign: "center",
    fontWeight: "900",
    color: Colors.text,
    paddingVertical: 6,
  },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallDangerText: { fontWeight: "900", color: Colors.dangerText },

  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 18 },

  // helper text
  helperTitle: { fontWeight: "900", color: Colors.text },
  helperText: { color: Colors.sub, fontWeight: "700" },

  // tabs
  tabs: {
    width: "100%",
    maxWidth: MAX_W,
    flexDirection: "row",
    gap: 10,
  },
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
