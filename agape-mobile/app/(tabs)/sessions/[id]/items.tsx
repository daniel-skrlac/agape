import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import type { BookingSessionResponseDTO, ItemDescriptorResponseDTO, TemplateBookItemDTO } from "@/src/models/generated";

import { toUserMessage } from "../../../../src/api//apiClient";
import { useBookingSession } from "../../../../src/api//hooks/sessions/useBookingSessions";
import { useItemDirectory } from "../../../../src/api//hooks/documents/useItemDirectory";

import { QtyMap, StandaloneMetaMap, useEntryDraft, patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function cleanText(v: unknown) {
  return String(v ?? "").trim();
}

function normItemId(x: any) {
  return Number(x?.itemId ?? x?.id ?? x?.item_id ?? x?.item?.id ?? 0);
}

function mergeItemMeta(prev: Map<number, ItemDescriptorResponseDTO>, items: ItemDescriptorResponseDTO[] | null | undefined) {
  const next = new Map(prev);
  for (const item of items ?? []) {
    const id = normItemId(item);
    if (!id) continue;
    next.set(id, item);
  }
  return next;
}

function formatItemDisplay(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>, row?: any) {
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

    return { name: rowName || "Artikl", meta: subtitle };
  }

  const m: any = metaById.get(Number(itemId));
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

  return { name: name || "Artikl", meta: subtitle };
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

function seedMetaMapFromStandaloneMeta(standaloneMetaById: StandaloneMetaMap | null | undefined) {
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

function buildStandaloneMetaPatch(qty: QtyMap, metaById: Map<number, ItemDescriptorResponseDTO>): StandaloneMetaMap {
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
  const session = sessionQ.data as BookingSessionResponseDTO | undefined;
  const warehouseId = Number((session as any)?.warehouseId ?? 0) || null;

  const { fetchItemsPage } = useItemDirectory({
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
    const seed = seedMetaMapFromStandaloneMeta((draft as any)?.standaloneMetaById);
    if (!seed.length) return;
    setMetaById((prev) => mergeItemMeta(prev, seed));
  }, [draft?.standaloneMetaById]);

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

  useEffect(() => {
    let alive = true;
    if (!warehouseId) return;
    if (!addedItems.length) return;

    const missing = addedItems
      .map((x) => Number((x as any)?.itemId))
      .filter((id) => id > 0)
      .filter((id) => !metaById.get(id));

    if (!missing.length) return;

    (async () => {
      const ids = missing.slice(0, 40);
      const patch: ItemDescriptorResponseDTO[] = [];

      for (const id of ids) {
        if (!alive) return;
        try {
          const res = await fetchItemsPage({ page: 0, size: 25, q: String(id) });
          const rows = (res.items ?? []) as ItemDescriptorResponseDTO[];
          const hit = rows.find((r: any) => Number((r as any)?.itemId) === id) ?? rows[0];
          if (hit) patch.push(hit);
        } catch {
        }
      }

      if (!alive) return;
      if (patch.length) setMetaById((prev) => mergeItemMeta(prev, patch));
    })();

    return () => {
      alive = false;
    };
  }, [warehouseId, addedItems, metaById, fetchItemsPage]);

  const topError = useMemo(() => {
    if (sessionQ.error) return toUserMessage(sessionQ.error, "Greška pri učitavanju sesije.");
    if (loadErr) return loadErr;
    return null;
  }, [sessionQ.error, loadErr]);

  const refreshNow = useCallback(() => {
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
    const prevMeta = ((draft as any)?.standaloneMetaById ?? {}) as StandaloneMetaMap;
    const patchMeta = buildStandaloneMetaPatch(qtyDraft, metaById);
    const nextMeta: StandaloneMetaMap = { ...prevMeta, ...patchMeta };

    patchDraft(sessionId, partnerId, {
      standaloneQty: qtyDraft,
      standaloneMetaById: nextMeta,
    });

    router.back();
  }, [sessionId, partnerId, qtyDraft, metaById, draft]);

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
              <Pressable style={[s.tabBtn, tab === "results" && s.tabBtnActive]} onPress={() => setTab("results")}>
                <Text style={[s.tabText, tab === "results" && s.tabTextActive]}>Rezultati</Text>
              </Pressable>

              <Pressable style={[s.tabBtn, tab === "added" && s.tabBtnActive]} onPress={() => setTab("added")}>
                <Text style={[s.tabText, tab === "added" && s.tabTextActive]}>Dodano ({addedItems.length})</Text>
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
                              <Text style={s.footerRetryText}>{loadMoreErr} • Dodirni za pokušaj ponovno</Text>
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
                keyExtractor={(x) => String((x as any).itemId)}
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
                        <Pressable style={s.qtyBtn} onPress={() => setQtyDraft((cur) => upsertQty(cur, itemId, -1))}>
                          <Text style={s.qtyBtnText}>−</Text>
                        </Pressable>

                        <View style={s.qtyPill}>
                          <Text style={s.qtyPillText}>{quantity}</Text>
                        </View>

                        <Pressable style={s.qtyBtn} onPress={() => setQtyDraft((cur) => upsertQty(cur, itemId, +1))}>
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

  list: { flex: 1, minHeight: 0 },
  listContent: { gap: 10 },

  center: { padding: 16, alignItems: "center", gap: 10 },
  centerInline: { paddingVertical: 14, alignItems: "center", gap: 10 },

  muted: { color: Colors.sub, fontWeight: "800" },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  btnWide: { width: "100%", padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "900", color: Colors.text },

  tabs: { width: "100%", flexDirection: "row", gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },
  tabBtnActive: { backgroundColor: "rgba(249,115,22,0.18)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(249,115,22,0.35)" },
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

  resultRow: { width: "100%", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  addBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "rgba(249,115,22,0.16)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(249,115,22,0.35)", alignItems: "center", justifyContent: "center" },
  addBtnText: { fontWeight: "900", color: Colors.text },

  addedRow: { width: "100%", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },

  qtyBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(148,163,184,0.12)", borderRadius: 14, padding: 6 },
  qtyBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontWeight: "900", color: Colors.text, fontSize: 18 },

  qtyPill: { minWidth: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(148,163,184,0.10)", alignItems: "center", justifyContent: "center" },
  qtyPillText: { fontWeight: "900", color: Colors.text },

  smallDangerBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: Colors.dangerBg, alignItems: "center", justifyContent: "center" },
  smallDangerText: { fontWeight: "900", color: Colors.dangerText },

  footerWrap: { paddingVertical: 12, alignItems: "center", gap: 8 },
  footerRetryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  footerRetryText: { color: Colors.text, fontWeight: "700", textAlign: "center" },
});