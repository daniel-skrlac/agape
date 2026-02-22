// app/(tabs)/sessions/[id]/partner.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import type { PartnerResponseDTO } from "@/app/models/generated";
import { partnerService } from "@/app/api/services/partnerService";

// ✅ IMPORTANT: clear draft before opening entry, so "deleted then add again" is blank
import { clearDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;

export default function SessionPartnerPicker() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [items, setItems] = useState<PartnerResponseDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false); // initial / refresh
  const [loadingMore, setLoadingMore] = useState(false); // pagination

  const hasMore = useMemo(() => {
    if (total == null) return true;
    return items.length < total;
  }, [items.length, total]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  // reset on search
  useEffect(() => {
    setItems([]);
    setTotal(null);
    setPage(0);
  }, [debouncedQ]);

  // load page
  useEffect(() => {
    let alive = true;

    (async () => {
      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await partnerService.pagePartners({ page, size: PAGE_SIZE, q: debouncedQ || "" });
        if (!alive) return;

        const nextItems = (res.items ?? []) as any[];
        const tot = Number((res as any).total ?? 0);
        setTotal(tot);

        setItems((cur) => {
          if (page === 0) return nextItems as any;

          // merge unique by id
          const seen = new Set(cur.map((x: any) => String((x as any).id)));
          const add = nextItems.filter((x: any) => !seen.has(String((x as any).id)));
          return [...cur, ...add] as any;
        });
      } catch {
        if (!alive) return;
        if (page === 0) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page, debouncedQ]);

  const pick = (p: any) => {
    const partnerId = Number(p?.id ?? 0);
    if (!partnerId) return;

    // ✅ KEY FIX: always clear local draft for this pair before opening editor
    clearDraft(sessionId, partnerId);

    router.push({
      pathname: "/(tabs)/sessions/[id]/entry" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const onEndReached = () => {
    if (loading || loadingMore) return;
    if (!hasMore) return;
    setPage((p) => p + 1);
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
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
            data={items}
            keyExtractor={(x: any) => String(x?.id)}
            contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => pick(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{(item as any).name}</Text>
                  <Text style={s.rowSub}>
                    #{(item as any).partnerNumber} • {(item as any).city}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
            ListFooterComponent={
              loadingMore ? (
                <View style={s.footerLoading}>
                  <ActivityIndicator />
                  <Text style={s.muted}>Učitavam još…</Text>
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
  wrap: { padding: 14, gap: 12, alignSelf: "center", width: "100%", maxWidth: MAX_W },

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
