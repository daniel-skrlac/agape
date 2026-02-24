import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import type {
  BookingSessionResponseDTO,
  ItemDescriptorResponseDTO,
  TemplateBookItemDTO,
} from "@/app/models/generated";

import { toUserMessage } from "@/app/api/apiClient";
import { useBookingSession } from "@/app/api/hooks/sessions/useBookingSessions";
import { useItemDirectoryPickerPage } from "@/app/api/hooks/documents/useItemDirectoryPickerPage";

import { QtyMap, useEntryDraft, patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function normItemId(x: any) {
  return Number(x?.itemId ?? x?.id ?? x?.item_id ?? x?.item?.id ?? 0);
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

function formatItemDisplay(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>, row?: any) {
  const rowName = String(row?.name ?? row?.itemName ?? "").trim();
  const rowCode = String(row?.code ?? row?.itemCode ?? "").trim();
  const rowUnit = String(row?.unit ?? "").trim();
  const rowBarcode = String(row?.barcode ?? "").trim();

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

  const m: any = metaById.get(Number(itemId));
  const name = String(m?.name ?? "").trim();
  const code = String(m?.code ?? "").trim();
  const unit = String(m?.unit ?? "").trim();
  const barcode = String(m?.barcode ?? "").trim();

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

export default function SessionEntryStandaloneItems() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);

  const tabBarHeight = useBottomTabBarHeight();
  const listBottomPad = tabBarHeight + 16;

  const sessionQ = useBookingSession(sessionId);
  const session = sessionQ.data as BookingSessionResponseDTO | undefined;
  const warehouseId = Number((session as any)?.warehouseId ?? 0) || null;

  const { fetchItemsPage } = useItemDirectoryPickerPage({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    enabled: !!warehouseId,
  });

  const draft = useEntryDraft(sessionId, partnerId);

  const [tab, setTab] = useState<"results" | "added">("results");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});
  const [metaById, setMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());

  const [page, setPage] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);

  const [items, setItems] = useState<ItemDescriptorResponseDTO[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadMoreErr, setLoadMoreErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 220);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    setQtyDraft({ ...(draft?.standaloneQty ?? {}) });
  }, [draft?.standaloneQty]);

  useEffect(() => {
    setPage(0);
    setItems([]);
    setTotal(0);
    setLoadErr(null);
    setLoadMoreErr(null);
    setReloadTick((x) => x + 1);
  }, [warehouseId, debouncedQ]);

  useEffect(() => {
    let alive = true;

    if (!warehouseId) return;

    (async () => {
      const isFirst = page === 0;

      try {
        if (isFirst) setLoading(true);
        else setLoadingMore(true);

        if (isFirst) setLoadErr(null);
        setLoadMoreErr(null);

        const res = await fetchItemsPage({
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
        if (isFirst) setLoadErr(msg);
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
  }, [warehouseId, debouncedQ, page, reloadTick, fetchItemsPage]);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  const addedItems = useMemo(() => qtyToItems(qtyDraft), [qtyDraft]);

  const topError = useMemo(() => {
    if (sessionQ.error) return toUserMessage(sessionQ.error, "Greška pri učitavanju sesije.");
    if (loadErr) return loadErr;
    return null;
  }, [sessionQ.error, loadErr]);

  const retryTop = useCallback(() => {
    setLoadErr(null);
    setLoadMoreErr(null);
    setItems([]);
    setTotal(0);
    setPage(0);
    setReloadTick((x) => x + 1);
    sessionQ.refetch?.();
  }, [sessionQ]);

  const onRefreshResults = useCallback(() => {
    setLoadErr(null);
    setLoadMoreErr(null);
    setItems([]);
    setTotal(0);
    setPage(0);
    setReloadTick((x) => x + 1);
    sessionQ.refetch?.();
  }, [sessionQ]);

  const onEndReached = useCallback(() => {
    if (!hasMore) return;
    if (loading || loadingMore) return;
    setPage((p) => p + 1);
  }, [hasMore, loading, loadingMore]);

  const apply = useCallback(() => {
    patchDraft(sessionId, partnerId, { standaloneQty: qtyDraft });
    router.back();
  }, [sessionId, partnerId, qtyDraft]);

  if (!draft) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <NavigationHeader
          title="Stavke"
          fallbackHref={{
            pathname: "/(tabs)/sessions/[id]/entry" as const,
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
        subtitle={`Partner #${partnerId}`}
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
            onAction={retryTop}
            titleLines={1}
            messageLines={3}
          />
        )}

        {!warehouseId ? (
          <ErrorCard
            title="Nedostaje skladište"
            message="Na sesiji nije postavljeno skladište."
            actionText="Natrag"
            onAction={() => router.back()}
            titleLines={1}
            messageLines={2}
          />
        ) : (
          <>
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
                    onRefresh={onRefreshResults}
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
                                setPage((p) => p + 1);
                              }}
                            >
                              <Text style={s.footerRetryText}>
                                {loadMoreErr} • Dodirni za pokušaj ponovno
                              </Text>
                            </Pressable>
                          ) : null}

                          {!loadingMore && !loadMoreErr && !hasMore && items.length > 0 ? (
                            <Text style={s.helper}>Kraj liste.</Text>
                          ) : null}
                        </View>
                      ) : null
                    }
                    renderItem={({ item }: any) => {
                      const id = normItemId(item);
                      const display = formatItemDisplay(id, metaById, item);

                      return (
                        <Pressable
                          style={s.resultRow}
                          onPress={() => {
                            setMetaById((prev) => mergeItemMeta(prev, [item]));
                            setQtyDraft((cur) => upsertQty(cur, id, 1));
                            setTab("added");
                          }}
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
                keyExtractor={(x) => String(x.itemId)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[s.listContent, { paddingBottom: listBottomPad }]}
                scrollIndicatorInsets={{ bottom: listBottomPad }}
                ListEmptyComponent={<Text style={s.helper}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>}
                renderItem={({ item }) => {
                  const itemId = Number((item as any)?.itemId);
                  const quantity = Number((item as any)?.quantity ?? 0);
                  const display = formatItemDisplay(itemId, metaById);

                  return (
                    <View style={s.addedRow}>
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
                          onPress={() => setQtyDraft((cur) => upsertQty(cur, itemId, -1))}
                        >
                          <Text style={s.qtyBtnText}>−</Text>
                        </Pressable>

                        <View style={s.qtyPill}>
                          <Text style={s.qtyPillText}>{quantity}</Text>
                        </View>

                        <Pressable
                          style={s.qtyBtn}
                          onPress={() => setQtyDraft((cur) => upsertQty(cur, itemId, +1))}
                        >
                          <Text style={s.qtyBtnText}>+</Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={s.smallDangerBtn}
                        onPress={() =>
                          setQtyDraft((cur) => {
                            const k = String(itemId);
                            const { [k]: _, ...rest } = cur;
                            return rest;
                          })
                        }
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

            <Pressable style={s.btnWide} onPress={() => router.back()}>
              <Text style={s.btnText}>Zatvori</Text>
            </Pressable>
          </>
        )}
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

  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
  },

  center: {
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  centerInline: {
    paddingVertical: 14,
    alignItems: "center",
    gap: 10,
  },

  muted: {
    color: Colors.sub,
    fontWeight: "800",
  },
  helper: {
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
  },

  primary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

  btnWide: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontWeight: "900",
    color: Colors.text,
  },

  tabs: {
    width: "100%",
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
  tabText: {
    fontWeight: "900",
    color: Colors.sub,
  },
  tabTextActive: {
    color: Colors.text,
  },

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
  search: {
    flex: 1,
    fontWeight: "800",
    color: Colors.text,
  },

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

  itemNameStrong: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 15,
  },
  itemMeta: {
    color: Colors.sub,
    fontWeight: "800",
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
  addBtnText: {
    fontWeight: "900",
    color: Colors.text,
  },

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
  qtyBtnText: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 18,
  },

  qtyPill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyPillText: {
    fontWeight: "900",
    color: Colors.text,
  },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallDangerText: {
    fontWeight: "900",
    color: Colors.dangerText,
  },

  footerWrap: {
    paddingVertical: 12,
    alignItems: "center",
    gap: 8,
  },
  footerRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  footerRetryText: {
    color: Colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});