import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { toUserMessage } from "@/src/api/apiClient";
import { useKeyboardInset } from "@/src/keyboard/KeyboardInsetProvider";

import type {
  ItemDescriptorResponseDTO,
  TemplateItemResponseDTO,
  TemplateItemUpsertRequestDTO,
} from "@/src/models/generated";

import { styles as s } from "@/components/styles/TemplateDocItemsEditorModal.styles";

type PagedItemsResult = {
  items: ItemDescriptorResponseDTO[];
  page: number;
  size: number;
  total: number;
};

type LocalTemplateItem = TemplateItemResponseDTO & {
  meta?: ItemDescriptorResponseDTO;
};

type Props = {
  visible: boolean;
  title?: string;
  documentId?: number | null;
  documentLabel?: string | null;
  documentSubtitle?: string | null;
  initialItems?: TemplateItemResponseDTO[] | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (items: TemplateItemUpsertRequestDTO[]) => Promise<void>;
  fetchItemsPage: (args: { page: number; size: number; q?: string }) => Promise<PagedItemsResult>;
};

const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function LockedCenterModal(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  disableClose?: boolean;
  onBodyScroll?: (event: any) => void;
  children: React.ReactNode;
}) {
  const { visible, title, onClose, disableClose, onBodyScroll, children } = props;
  const keyboard = useKeyboardInset();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={disableClose ? undefined : onClose}
    >
      <View
        style={[
          s.modalWrap,
          keyboard.visible && {
            justifyContent: "flex-start",
            paddingTop: 24,
            paddingBottom: keyboard.bottom + 16,
          },
        ]}
      >
        <View style={s.backdrop} />

        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>

            <Pressable
              style={[s.iconBtn, disableClose && s.disabled]}
              disabled={disableClose}
              onPress={disableClose ? undefined : onClose}
            >
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              s.modalBody,
              keyboard.visible ? { paddingBottom: keyboard.bottom + 24 } : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={onBodyScroll}
            scrollEventThrottle={16}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function TemplateDocItemsEditorModal(props: Props) {
  const {
    visible,
    title = "Stavke dokumenta",
    documentId,
    documentLabel,
    documentSubtitle,
    initialItems,
    loading = false,
    onClose,
    onSave,
    fetchItemsPage,
  } = props;

  const [items, setItems] = useState<LocalTemplateItem[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerDebouncedQ, setPickerDebouncedQ] = useState("");
  const [pickerItems, setPickerItems] = useState<ItemDescriptorResponseDTO[]>([]);
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerTotal, setPickerTotal] = useState(0);
  const [pickerLoadedQuery, setPickerLoadedQuery] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerLoadingMore, setPickerLoadingMore] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [dismissedTopError, setDismissedTopError] = useState<string | null>(null);

  const fetchReqRef = useRef(0);

  useEffect(() => {
    const tt = setTimeout(() => setPickerDebouncedQ(pickerQ.trim()), 250);
    return () => clearTimeout(tt);
  }, [pickerQ]);

  useEffect(() => {
    if (!visible) return;

    setItems(((initialItems ?? []) as LocalTemplateItem[]).map((x) => ({ ...x })));

    setScreenError(null);
    setDismissedTopError(null);

    setPickerOpen(false);
    setPickerQ("");
    setPickerDebouncedQ("");
    setPickerItems([]);
    setPickerPage(0);
    setPickerTotal(0);
    setPickerLoadedQuery(null);
    setPickerLoading(false);
    setPickerLoadingMore(false);
    setPickerError(null);
  }, [visible, documentId, initialItems]);

  const rawTopError = screenError || pickerError;
  const topError = rawTopError && rawTopError !== dismissedTopError ? rawTopError : null;

  const closeTopError = () => {
    setScreenError(null);
    setPickerError(null);
    setDismissedTopError(rawTopError ?? null);
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)),
    [items]
  );

  const hasMorePickerResults = pickerItems.length < pickerTotal;
  const missingItemMetaKey = useMemo(
    () =>
      sortedItems
        .map((item) => Number(item.itemId))
        .filter((itemId) => {
          if (!itemId) return false;
          const row = sortedItems.find((item) => Number(item.itemId) === itemId);
          return !row?.itemName?.trim() && !row?.meta?.name?.trim();
        })
        .sort((a, b) => a - b)
        .join(","),
    [sortedItems]
  );

  const loadPickerPage = useCallback(
    async (page: number, append: boolean) => {
      const reqId = ++fetchReqRef.current;

      if (append) {
        setPickerLoadingMore(true);
      } else {
        setPickerLoading(true);
        setPickerError(null);
      }

      try {
        const res = await fetchItemsPage({
          page,
          size: PAGE_SIZE,
          q: pickerDebouncedQ || undefined,
        });

        if (reqId !== fetchReqRef.current) return;

        const incoming = res.items ?? [];

        setPickerPage(Number(res.page ?? page));
        setPickerTotal(Number(res.total ?? 0));

        setPickerItems((prev) => {
          if (!append) return incoming;

          const map = new Map<number, ItemDescriptorResponseDTO>();
          for (const x of prev) map.set(Number(x.itemId), x);
          for (const x of incoming) map.set(Number(x.itemId), x);
          return Array.from(map.values());
        });

        if (!append) {
          setPickerLoadedQuery(pickerDebouncedQ || "");
        }
      } catch (e) {
        if (reqId !== fetchReqRef.current) return;
        setPickerError(toUserMessage(e, "Greška pri učitavanju artikala."));
      } finally {
        if (reqId !== fetchReqRef.current) return;
        setPickerLoading(false);
        setPickerLoadingMore(false);
      }
    },
    [fetchItemsPage, pickerDebouncedQ]
  );

  useEffect(() => {
    if (!visible || !pickerOpen) return;
    if (pickerLoadedQuery === (pickerDebouncedQ || "")) return;
    void loadPickerPage(0, false);
  }, [visible, pickerOpen, pickerDebouncedQ, pickerLoadedQuery, loadPickerPage]);

  useEffect(() => {
    if (!visible || pickerOpen || !missingItemMetaKey) return;

    let alive = true;
    const ids = missingItemMetaKey
      .split(",")
      .map((x) => Number(x))
      .filter((x) => x > 0);

    (async () => {
      const found = new Map<number, ItemDescriptorResponseDTO>();

      for (const itemId of ids) {
        try {
          const res = await fetchItemsPage({
            page: 0,
            size: 25,
            q: String(itemId),
          });

          const exact = (res.items ?? []).find((item) => Number(item.itemId) === itemId);
          if (exact) found.set(itemId, exact);
        } catch {
          // Keep the modal usable; unresolved rows still show their item id.
        }
      }

      if (!alive || found.size === 0) return;

      setItems((prev) =>
        prev.map((item) => {
          const itemId = Number(item.itemId);
          const meta = found.get(itemId);
          if (!meta) return item;
          return {
            ...item,
            itemName: item.itemName?.trim() || meta.name || "",
            itemCode: item.itemCode?.trim() || meta.code || "",
            unit: item.unit?.trim() || meta.unit || "",
            meta: item.meta ?? meta,
          };
        })
      );
    })();

    return () => {
      alive = false;
    };
  }, [fetchItemsPage, missingItemMetaKey, pickerOpen, visible]);

  const openPicker = () => {
    setScreenError(null);
    setPickerError(null);
    setDismissedTopError(null);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerLoading(false);
    setPickerLoadingMore(false);
    setPickerError(null);
  };

  const loadMorePicker = useCallback(async () => {
    if (pickerLoading || pickerLoadingMore || !hasMorePickerResults) return;
    await loadPickerPage(pickerPage + 1, true);
  }, [hasMorePickerResults, loadPickerPage, pickerLoading, pickerLoadingMore, pickerPage]);

  const handleBodyScroll = useCallback(
    (event: any) => {
      if (!pickerOpen || pickerLoading || pickerLoadingMore || !hasMorePickerResults) return;

      const native = event?.nativeEvent;
      const visibleHeight = Number(native?.layoutMeasurement?.height ?? 0);
      const offsetY = Number(native?.contentOffset?.y ?? 0);
      const contentHeight = Number(native?.contentSize?.height ?? 0);

      if (!Number.isFinite(visibleHeight + offsetY + contentHeight) || contentHeight <= 0) return;
      if (visibleHeight + offsetY >= contentHeight - 180) {
        void loadMorePicker();
      }
    },
    [hasMorePickerResults, loadMorePicker, pickerLoading, pickerLoadingMore, pickerOpen]
  );

  const addOne = (meta: ItemDescriptorResponseDTO) => {
    setScreenError(null);
    setPickerError(null);
    setDismissedTopError(null);

    setItems((prev) => {
      const list = [...prev];
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
        } as LocalTemplateItem);
      }

      return list.map((x, i) => ({ ...x, sortOrder: i + 1 }));
    });

    closePicker();
  };

  const setQtyFor = (itemId: number, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) return;

    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => Number(x.itemId) === Number(itemId));
      if (idx < 0) return prev;

      next[idx] = { ...next[idx], quantity: qty };
      return next;
    });
  };

  const bumpQty = (itemId: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => Number(x.itemId) === Number(itemId));
      if (idx < 0) return prev;

      const cur = Number(next[idx].quantity ?? 0);
      const val = cur + delta;
      if (!Number.isFinite(val) || val <= 0) return prev;

      next[idx] = { ...next[idx], quantity: val };
      return next;
    });
  };

  const removeItem = (itemId: number) => {
    setItems((prev) => {
      const filtered = prev.filter((x) => Number(x.itemId) !== Number(itemId));
      return filtered.map((x, i) => ({ ...x, sortOrder: i + 1 }));
    });
  };

  const handleSave = async () => {
    try {
      setScreenError(null);
      setPickerError(null);
      setDismissedTopError(null);

      if (items.some((x) => !Number.isFinite(Number(x.quantity)) || Number(x.quantity) <= 0)) {
        setScreenError("Sve količine moraju biti broj veći od 0.");
        return;
      }

      const payload: TemplateItemUpsertRequestDTO[] = items.map((x, i) => ({
        itemId: x.itemId,
        quantity: Number(x.quantity),
        sortOrder: i + 1,
        itemName: x.itemName?.trim() || x.meta?.name?.trim() || "",
        name: x.itemName?.trim() || x.meta?.name?.trim() || "",
        itemCode: x.itemCode?.trim() || x.meta?.code?.trim() || "",
        code: x.itemCode?.trim() || x.meta?.code?.trim() || "",
        unit: x.unit?.trim() || x.meta?.unit?.trim() || "",
        barcode: (x as any)?.barcode?.trim?.() || (x.meta as any)?.barcode?.trim?.() || "",
      } as any));

      await onSave(payload);
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri spremanju stavki."));
    }
  };

  return (
    <LockedCenterModal
      visible={visible}
      title={pickerOpen ? "Odaberi artikl" : title}
      disableClose={loading}
      onBodyScroll={handleBodyScroll}
      onClose={() => {
        if (loading) return;
        onClose();
      }}
    >
      <View style={s.centerBlock}>
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText={pickerOpen ? "Pokušaj ponovno" : "Zatvori"}
            onAction={() => {
              if (!pickerOpen) {
                closeTopError();
                return;
              }
              setScreenError(null);
              setPickerError(null);
              setDismissedTopError(null);
              void loadPickerPage(0, false);
            }}
            titleLines={1}
            messageLines={3}
          />
        )}

        <Text style={s.sheetTitle}>{documentLabel || (documentId ? `Dokument #${documentId}` : "Dokument")}</Text>
        {!!documentSubtitle ? <Text style={s.sheetSubtitle}>{documentSubtitle}</Text> : null}

        {!pickerOpen ? (
          <>
            <Pressable
              style={[s.primary, loading && s.disabled]}
              disabled={loading}
              onPress={openPicker}
            >
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.primaryText}>Dodaj artikl</Text>
            </Pressable>

            <View style={s.block}>
              <Text style={s.blockTitle}>Dodane stavke ({sortedItems.length})</Text>

              {sortedItems.length === 0 ? (
                <Text style={s.muted}>Još nema stavki. Dodaj artikle preko gumba “Dodaj artikl”.</Text>
              ) : (
                <View style={s.itemsList}>
                  {sortedItems.map((x) => {
                    const itemName =
                      x.itemName?.trim() ||
                      x.meta?.name?.trim() ||
                      `Artikl #${x.itemId}`;

                    const code =
                      x.itemCode?.trim()
                        ? `Šifra: ${x.itemCode}`
                        : x.meta?.code
                          ? `Šifra: ${x.meta.code}`
                          : null;

                    const unit =
                      x.unit?.trim()
                        ? `JMJ: ${x.unit}`
                        : x.meta?.unit
                          ? `JMJ: ${x.meta.unit}`
                          : null;

                    return (
                      <View key={String(x.itemId)} style={s.itemRow}>
                        <View style={s.itemInfo}>
                          <Text style={s.itemNameStrong} numberOfLines={2}>
                            {itemName}
                          </Text>

                          <Text style={s.itemMeta}>
                            {[code, `ID: ${x.itemId}`, unit].filter(Boolean).join(" • ")}
                          </Text>
                        </View>

                        <View style={s.qtyBox}>
                          <Pressable
                            style={s.qtyBtn}
                            onPress={() => bumpQty(x.itemId, -1)}
                            disabled={loading}
                          >
                            <Text style={s.qtyBtnText}>−</Text>
                          </Pressable>

                          <TextInput
                            value={String(x.quantity ?? "")}
                            onChangeText={(v) => {
                              const raw = String(v).replace(",", ".");
                              const n = Number(raw);
                              if (!Number.isFinite(n)) return;
                              setQtyFor(x.itemId, n);
                            }}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={PLACEHOLDER}
                            style={s.qtyInput}
                            editable={!loading}
                          />

                          <Pressable
                            style={s.qtyBtn}
                            onPress={() => bumpQty(x.itemId, +1)}
                            disabled={loading}
                          >
                            <Text style={s.qtyBtnText}>+</Text>
                          </Pressable>
                        </View>

                        <Pressable
                          style={[s.smallDangerBtn, loading && s.disabled]}
                          disabled={loading}
                          onPress={() => removeItem(x.itemId)}
                        >
                          <Text style={s.smallDangerText}>X</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable
              style={[s.primary, loading && s.disabled]}
              disabled={loading}
              onPress={handleSave}
            >
              <Text style={s.primaryText}>{loading ? "Spremam…" : "Spremi stavke"}</Text>
            </Pressable>

            <Pressable
              style={s.btnWide}
              disabled={loading}
              onPress={() => {
                if (loading) return;
                onClose();
              }}
            >
              <Text style={s.btnText}>Zatvori</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.block}>
              <TextInput
                value={pickerQ}
                onChangeText={setPickerQ}
                placeholder="Pretraži artikle (naziv, šifra, ID)…"
                placeholderTextColor={PLACEHOLDER}
                style={s.input}
                autoCorrect={false}
                autoCapitalize="none"
                editable={!pickerLoading && !pickerLoadingMore}
              />

              <View style={s.pickerMetaRow}>
                <Text style={s.blockTitle}>Rezultati ({pickerItems.length}{pickerTotal ? ` / ${pickerTotal}` : ""})</Text>
                <Text style={s.selectedCount}>Dodano: {sortedItems.length}</Text>
              </View>

              {pickerLoading ? (
                <View style={s.loaderWrap}>
                  <ActivityIndicator />
                </View>
              ) : pickerItems.length === 0 ? (
                <Text style={s.muted}>Nema rezultata.</Text>
              ) : (
                <View style={s.itemsList}>
                  {pickerItems.map((it) => (
                    <Pressable
                      key={String(it.itemId)}
                      style={s.pickRow}
                      onPress={() => addOne(it)}
                      disabled={loading}
                    >
                      <View style={s.pickRowContent}>
                        <View style={s.pickRowInfo}>
                          <Text style={s.pickTitle} numberOfLines={2}>
                            {it.name?.trim() ? it.name : "Učitavam artikl…"}
                          </Text>

                          <Text style={s.pickSub}>
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

                        <View style={s.addBtn}>
                          <Text style={s.addBtnText}>+1</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {pickerLoadingMore ? (
                <View style={s.loadMoreInline}>
                  <ActivityIndicator size="small" />
                  <Text style={s.muted}>Učitavam još artikala…</Text>
                </View>
              ) : null}
            </View>

            <View style={s.rowBtns}>
              <Pressable
                style={[s.btnWide, s.rowBtn]}
                disabled={loading}
                onPress={closePicker}
              >
                <Text style={s.btnText}>Natrag</Text>
              </Pressable>

              <Pressable
                style={[s.primary, s.rowBtn, loading && s.disabled]}
                disabled={loading}
                onPress={closePicker}
              >
                <Text style={s.primaryText}>Gotovo</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </LockedCenterModal>
  );
}
