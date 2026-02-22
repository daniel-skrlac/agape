// app/(tabs)/sessions/[id]/items.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import NavigationHeader from "@/components/NavigationHeader";

import type {
  BookingSessionResponseDTO,
  ItemDescriptorResponseDTO,
  TemplateBookItemDTO,
} from "@/app/models/generated";

import { useBookingSession } from "@/app/api/hooks/useBookingSessions";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";

import { QtyMap, useEntryDraft, patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

// bottom guard to avoid bottom tabs covering last row in RESULTS list
const TAB_BAR_GUARD = 72;

function normItemId(x: any) {
  return Number(x?.itemId ?? x?.id ?? x?.item_id ?? x?.item?.id ?? 0);
}

function upsertMetaMap(prev: Map<number, ItemDescriptorResponseDTO>, items: any[] | null | undefined) {
  const next = new Map(prev);
  (items ?? []).forEach((it) => {
    const id = normItemId(it);
    if (!id) return;
    next.set(id, it as any);
  });
  return next;
}

function itemName(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  return metaById.get(Number(itemId))?.name?.trim() ?? "";
}
function itemMeta(itemId: number, metaById: Map<number, ItemDescriptorResponseDTO>) {
  const m: any = metaById.get(Number(itemId));
  if (!m) return "";
  const parts = [
    m.code ? `Šifra: ${m.code}` : null,
    m.unit ? `JMJ: ${m.unit}` : null,
    m.barcode ? `BC: ${m.barcode}` : null,
  ].filter(Boolean);
  return parts.join(" • ");
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

function Spacer({ h }: { h: number }) {
  return <View style={{ height: h }} />;
}

export default function SessionEntryStandaloneItems() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);

  const insets = useSafeAreaInsets();

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;
  const warehouseId = Number((session as any)?.warehouseId ?? 0) || null;

  const draft = useEntryDraft(sessionId, partnerId);

  const [tab, setTab] = useState<"results" | "added">("results");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  // qty draft
  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});
  useEffect(() => {
    setQtyDraft({ ...(draft?.standaloneQty ?? {}) });
  }, [draft?.standaloneQty]);

  // infinite list state (RESULTS)
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ItemDescriptorResponseDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const hasMore = items.length < total;

  // cache for names in ADDED tab
  const [metaById, setMetaById] = useState<Map<number, ItemDescriptorResponseDTO>>(new Map());

  // reset list when search or warehouse changes
  useEffect(() => {
    setPage(0);
    setItems([]);
    setTotal(0);
    setLoadErr(null);
  }, [warehouseId, debouncedQ]);

  // load page (RESULTS)
  useEffect(() => {
    let alive = true;
    if (!warehouseId) return;

    (async () => {
      const isFirst = page === 0;
      try {
        if (isFirst) setLoading(true);
        else setLoadingMore(true);

        setLoadErr(null);

        const res = await itemDirectoryService.pageItems({
          warehouseId,
          page,
          size: PAGE_SIZE,
          q: debouncedQ || undefined,
        });

        if (!alive) return;

        const newItems = (res.items ?? []) as any[];
        setTotal(Number(res.total ?? 0));

        setItems((prev) => {
          if (isFirst) return newItems as any;

          const seen = new Set(prev.map((x: any) => String(normItemId(x))));
          const merged = [...prev];

          for (const it of newItems) {
            const id = String(normItemId(it));
            if (!id || id === "0") continue;
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push(it);
          }
          return merged as any;
        });

        setMetaById((prev) => upsertMetaMap(prev, newItems));
      } catch (e: any) {
        if (!alive) return;
        setLoadErr(e?.message ?? "Greška pri dohvaćanju artikala.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [warehouseId, debouncedQ, page]);

  const onEndReached = () => {
    if (!hasMore) return;
    if (loading || loadingMore) return;
    setPage((p) => p + 1);
  };

  const requiredItemIds = useMemo(
    () => qtyToItems(qtyDraft).map((x) => Number(x.itemId)).filter(Boolean),
    [qtyDraft]
  );

  const namesReady = useMemo(() => {
    for (const id of requiredItemIds) if (!metaById.get(id)?.name?.trim()) return false;
    return true;
  }, [requiredItemIds, metaById]);

  const err = (sQ.error as any)?.message || loadErr || null;

  const apply = () => {
    patchDraft(sessionId, partnerId, { standaloneQty: qtyDraft });
    router.back();
  };

  // ✅ ONLY results list needs bottom guard (to avoid bottom tabs)
  const resultsBottomSpace = Math.max(14, insets.bottom) + TAB_BAR_GUARD;

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
        <View style={{ padding: 16, alignItems: "center", gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ color: Colors.sub, fontWeight: "800" }}>Učitavam…</Text>
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
        {!!err && <Banner type="error" text={String(err)} />}

        {!warehouseId ? (
          <Banner type="error" text="Nema warehouseId na evidenciji." />
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
                  Dodano ({qtyToItems(qtyDraft).length})
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
                  <View style={{ paddingVertical: 14, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : (
                  <FlatList
                    data={items}
                    keyExtractor={(it: any) => String(normItemId(it))}
                    keyboardShouldPersistTaps="handled"
                    onEndReachedThreshold={0.35}
                    onEndReached={onEndReached}
                    contentContainerStyle={{ gap: 10, paddingBottom: resultsBottomSpace }}
                    ListEmptyComponent={<Text style={s.helper}>Nema rezultata.</Text>}
                    ListFooterComponent={
                      <>
                        {loadingMore ? (
                          <View style={{ paddingVertical: 14, alignItems: "center" }}>
                            <ActivityIndicator />
                          </View>
                        ) : !hasMore && items.length > 0 ? (
                          <Text style={[s.helper, { paddingVertical: 10 }]}>Kraj liste.</Text>
                        ) : null}
                        {/* ONLY in results */}
                        <Spacer h={resultsBottomSpace} />
                      </>
                    }
                    renderItem={({ item }: any) => (
                      <Pressable
                        style={s.resultRow}
                        onPress={() => {
                          const id = normItemId(item);
                          setMetaById((prev) => upsertMetaMap(prev, [item]));
                          setQtyDraft((cur) => upsertQty(cur, id, 1));
                          setTab("added");
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemNameStrong} numberOfLines={2}>
                            {item?.name}
                          </Text>
                          {!![item?.code, item?.unit].filter(Boolean).length && (
                            <Text style={s.itemMeta} numberOfLines={1}>
                              {[item?.code ? `Šifra: ${item.code}` : null, item?.unit ? `JMJ: ${item.unit}` : null]
                                .filter(Boolean)
                                .join(" • ")}
                            </Text>
                          )}
                        </View>

                        <View style={s.addBtn}>
                          <Text style={s.addBtnText}>+1</Text>
                        </View>
                      </Pressable>
                    )}
                  />
                )}
              </>
            ) : (
              // ✅ ADDED: NO spacer, NO extra bottom padding
              <View style={{ gap: 10 }}>
                {!namesReady ? (
                  <View style={{ paddingVertical: 14, alignItems: "center", gap: 10 }}>
                    <ActivityIndicator />
                    <Text style={s.helper}>Učitavam nazive stavki…</Text>
                  </View>
                ) : qtyToItems(qtyDraft).length === 0 ? (
                  <Text style={s.helper}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {qtyToItems(qtyDraft).map((x) => {
                      const nm = itemName(Number(x.itemId), metaById) || `Item #${x.itemId}`;
                      const meta = itemMeta(Number(x.itemId), metaById);

                      return (
                        <View key={String(x.itemId)} style={s.addedRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNameStrong} numberOfLines={2}>
                              {nm}
                            </Text>
                            {!!meta && (
                              <Text style={s.itemMeta} numberOfLines={1}>
                                {meta}
                              </Text>
                            )}
                          </View>

                          <View style={s.qtyBox}>
                            <Pressable
                              style={s.qtyBtn}
                              onPress={() => setQtyDraft((cur) => upsertQty(cur, Number(x.itemId), -1))}
                            >
                              <Text style={s.qtyBtnText}>−</Text>
                            </Pressable>

                            <View style={s.qtyPill}>
                              <Text style={s.qtyPillText}>{Number(x.quantity ?? 0)}</Text>
                            </View>

                            <Pressable
                              style={s.qtyBtn}
                              onPress={() => setQtyDraft((cur) => upsertQty(cur, Number(x.itemId), +1))}
                            >
                              <Text style={s.qtyBtnText}>+</Text>
                            </Pressable>
                          </View>

                          <Pressable
                            style={s.smallDangerBtn}
                            onPress={() =>
                              setQtyDraft((cur) => {
                                const k = String(x.itemId);
                                const { [k]: _, ...rest } = cur;
                                return rest;
                              })
                            }
                          >
                            <Text style={s.smallDangerText}>X</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
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
  wrap: { padding: 14, gap: 12, alignSelf: "center", width: "100%", maxWidth: MAX_W },

  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  btnWide: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
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
});
