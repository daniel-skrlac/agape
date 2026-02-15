import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Colors from "@/constants/Colors";
import { ErrorCard } from "./ErrorCard";

type PageResult<T> = { items: T[]; page: number; size: number; total: number };
type FetchPage<T> = (args: { page: number; size: number; q?: string }) => Promise<PageResult<T>>;

type Props<T> = {
  visible: boolean;
  title: string;
  onClose: () => void;
  keyOf: (item: T) => string;
  fetchPage: FetchPage<T>;
  renderRow: (item: T, close: () => void) => React.ReactElement;
  initialSize?: number;
  searchPlaceholder?: string;
  closeOnBackdropPress?: boolean;
};

export function SearchPickerSheet<T>(props: Props<T>) {
  const {
    visible,
    title,
    onClose,
    keyOf,
    fetchPage,
    renderRow,
    initialSize = 20,
    searchPlaceholder = "Pretraži…",
    closeOnBackdropPress = false,
  } = props;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(initialSize);

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const close = () => onClose();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const resetAndLoad = async () => {
    setError(null);
    setLoading(true);
    setLoadingMore(false);
    setItems([]);
    setTotal(0);
    setPage(0);

    const rid = ++requestIdRef.current;
    try {
      const res = await fetchPage({ page: 0, size, q: debouncedQ || undefined });
      if (!mountedRef.current || rid !== requestIdRef.current) return;

      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setPage(res.page ?? 0);
    } catch (e: any) {
      if (!mountedRef.current || rid !== requestIdRef.current) return;
      setError(e?.message ?? "Greška prilikom učitavanja.");
    } finally {
      if (!mountedRef.current || rid !== requestIdRef.current) return;
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loading || loadingMore) return;
    if (!canLoadMore) return;

    setError(null);
    setLoadingMore(true);

    const nextPage = page + 1;
    const rid = ++requestIdRef.current;

    try {
      const res = await fetchPage({ page: nextPage, size, q: debouncedQ || undefined });
      if (!mountedRef.current || rid !== requestIdRef.current) return;

      setItems((prev) => [...prev, ...(res.items ?? [])]);
      setTotal(res.total ?? total);
      setPage(res.page ?? nextPage);
    } catch (e: any) {
      if (!mountedRef.current || rid !== requestIdRef.current) return;
      setError(e?.message ?? "Greška prilikom učitavanja.");
    } finally {
      if (!mountedRef.current || rid !== requestIdRef.current) return;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (visible) {
      setQ("");
      setDebouncedQ("");
      setTimeout(() => resetAndLoad(), 0);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    resetAndLoad();
  }, [debouncedQ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={s.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeOnBackdropPress ? close : undefined}
        />

        <View style={s.card} pointerEvents="auto">
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>
              {title}
            </Text>
            <Pressable style={s.closeBtn} onPress={close} hitSlop={8}>
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <FontAwesome name="search" size={14} color={Colors.sub} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={searchPlaceholder}
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

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator />
              <Text style={s.muted}>Učitavam…</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <ErrorCard
                title="Greška prilikom učitavanja"
                message={error}
                primaryText="Pokušaj ponovno"
                onPrimary={resetAndLoad}
                secondaryText="Zatvori"
                onSecondary={close}
              />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={keyOf}
              contentContainerStyle={s.list}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.4}
              onEndReached={loadMore}
              renderItem={({ item }) => renderRow(item, close)}
              ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 12 }}>
                    <ActivityIndicator />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "78%",
    backgroundColor: Colors.bg,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 16 },
  closeBtn: { padding: 6, borderRadius: 999 },

  searchWrap: {
    margin: 14,
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

  list: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },

  center: { padding: 20, alignItems: "center", gap: 10 },
  muted: { color: Colors.sub, fontWeight: "800" },
  error: { color: Colors.dangerText ?? "#ef4444", fontWeight: "900", textAlign: "center" },
  retry: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.orange,
  },
  retryText: { color: "#fff", fontWeight: "900" },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },
});
