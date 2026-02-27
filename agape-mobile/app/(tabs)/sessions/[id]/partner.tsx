import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import type { PartnerResponseDTO } from "@/src/models/generated";
import { partnerService } from "../../../../src/api//services/partnerService";

import { clearDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;

export default function SessionPartnerPicker() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const tabBarHeight = useBottomTabBarHeight();
  const listBottomPad = tabBarHeight + 16;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [items, setItems] = useState<PartnerResponseDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const endReachedLockRef = useRef(false);

  const isEmpty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setItems([]);
    setTotal(null);
    setPage(0);
    setHasMore(true);
    endReachedLockRef.current = false;
  }, [debouncedQ]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await partnerService.pagePartners(
          { page, size: PAGE_SIZE, q: debouncedQ || "" },
          controller.signal
        );
        if (!alive) return;

        const nextItems = ((res.items ?? []) as PartnerResponseDTO[]) ?? [];
        const rawCount = nextItems.length;

        const backendTotal = Number((res as any)?.total ?? 0);
        setTotal(Number.isFinite(backendTotal) ? backendTotal : 0);

        if (page === 0) {
          const seen = new Set<string>();
          const uniqueFirstPage = nextItems.filter((x: any) => {
            const id = String((x as any)?.id ?? "");
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });

          setItems(uniqueFirstPage as any);

          setHasMore(rawCount >= PAGE_SIZE);
        } else {
          let uniqueAddedCount = 0;

          setItems((cur) => {
            const seen = new Set(cur.map((x: any) => String((x as any)?.id)));
            const add = nextItems.filter((x: any) => {
              const id = String((x as any)?.id ?? "");
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });

            uniqueAddedCount = add.length;
            return [...cur, ...(add as any)] as any;
          });

          if (rawCount === 0 || rawCount < PAGE_SIZE || uniqueAddedCount === 0) {
            setHasMore(false);
          }
        }
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;

        if (page === 0) {
          setItems([]);
          setTotal(0);
        }
        setHasMore(false);
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, debouncedQ]);

  const pick = (p: any) => {
    const partnerId = Number(p?.id ?? 0);
    if (!partnerId) return;

    clearDraft(sessionId, partnerId);

    router.replace({
      pathname: "/(tabs)/sessions/[id]/entry" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const onEndReached = () => {
    if (endReachedLockRef.current) return;
    endReachedLockRef.current = true;

    if (loading || loadingMore) return;
    if (!hasMore) return;

    setPage((p) => p + 1);
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }}>
      <NavigationHeader
        title="Odaberi partnera"
        fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }}
      />

      <View style={s.wrap}>
        <View style={s.searchWrap}>
          <FontAwesome name="search" size={14} color={Colors.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pretraži partnere…"
            placeholderTextColor={Colors.sub}
            style={s.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!q && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <FontAwesome name="times-circle" size={16} color={Colors.sub} />
            </Pressable>
          )}
        </View>

        {loading && items.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.muted}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            style={s.list}
            data={items}
            keyExtractor={(x: any) => String((x as any)?.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.listContent, { paddingBottom: listBottomPad }]}
            scrollIndicatorInsets={{ bottom: listBottomPad }}
            onMomentumScrollBegin={() => {
              endReachedLockRef.current = false;
            }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.45}
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => pick(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{(item as any)?.name}</Text>
                  <Text style={s.rowSub}>
                    #{(item as any)?.partnerNumber} • {(item as any)?.city}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={isEmpty ? <Text style={s.empty}>Nema rezultata.</Text> : null}
            ListFooterComponent={
              loadingMore ? (
                <View style={s.footerLoading}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
          />
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

  searchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: {
    flex: 1,
    height: 24,
    paddingVertical: 0,
    fontWeight: "800",
    color: Colors.text,
    fontSize: 14,
  },

  list: {
    flex: 1,
    minHeight: 0,
  },

  listContent: {
    gap: 10,
  },

  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontWeight: "900", color: Colors.text },
  rowSub: { color: Colors.sub, fontWeight: "800" },

  center: { padding: 20, alignItems: "center", gap: 10 },
  muted: { color: Colors.sub, fontWeight: "800" },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },

  footerLoading: { paddingVertical: 14, alignItems: "center", gap: 10 },
});