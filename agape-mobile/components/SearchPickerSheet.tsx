import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useInfiniteQuery } from "@tanstack/react-query";

import Colors from "@/src/constants/Colors";
import { ErrorCard } from "./ErrorCard";
import { useKeyboardInset } from "@/src/keyboard/KeyboardInsetProvider";

type PageResult<T> = {
  items: T[];
  page: number;
  size: number;
  total: number;
};

type QueryPage<T> = (args: {
  page: number;
  size: number;
  q?: string;
  signal?: AbortSignal;
}) => Promise<PageResult<T>>;

type Props<T> = {
  visible: boolean;
  title: string;
  onClose: () => void;
  keyOf: (item: T) => string;
  queryKeyBase: readonly unknown[];
  queryPage: QueryPage<T>;
  renderRow: (item: T, close: () => void) => React.ReactElement;
  initialSize?: number;
  searchPlaceholder?: string;
  closeOnBackdropPress?: boolean;
  staleTime?: number;
  gcTime?: number;
  renderFooter?: (close: () => void) => React.ReactNode;
};

export function SearchPickerSheet<T>(props: Props<T>) {
  const {
    visible,
    title,
    onClose,
    keyOf,
    queryKeyBase,
    queryPage,
    renderRow,
    initialSize = 20,
    searchPlaceholder = "Pretraži…",
    closeOnBackdropPress = false,
    staleTime = 15 * 60 * 1000,
    gcTime = 24 * 60 * 60 * 1000,
    renderFooter,
  } = props;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const keyboard = useKeyboardInset();

  const size = initialSize;
  const normalizedQ = debouncedQ.trim();

  const close = () => onClose();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (visible) {
      setQ("");
      setDebouncedQ("");
    }
  }, [visible]);

  const query = useInfiniteQuery({
    queryKey: [...queryKeyBase, normalizedQ, size],
    enabled: visible,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      queryPage({
        page: Number(pageParam ?? 0),
        size,
        q: normalizedQ || undefined,
        signal,
      }),
    getNextPageParam: (lastPage) => {
      const page = Number(lastPage?.page ?? 0);
      const pageSize = Number(lastPage?.size ?? size);
      const total = Number(lastPage?.total ?? 0);

      const loaded = (page + 1) * pageSize;
      return loaded < total ? page + 1 : undefined;
    },
    staleTime,
    gcTime,
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p?.items ?? []),
    [query.data]
  );

  const total = Number(query.data?.pages?.[0]?.total ?? 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View
        style={[
          s.backdrop,
          keyboard.visible && {
            justifyContent: "flex-start",
            paddingTop: 28,
            paddingBottom: keyboard.bottom + 16,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeOnBackdropPress ? close : Keyboard.dismiss}
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

          {query.isLoading ? (
            <View style={s.center}>
              <ActivityIndicator />
              <Text style={s.muted}>Učitavam…</Text>
            </View>
          ) : query.error ? (
            <View style={s.center}>
              <ErrorCard
                title="Greška prilikom učitavanja"
                message={(query.error as any)?.message ?? "Greška prilikom učitavanja."}
                actionText="Pokušaj ponovno"
                onAction={() => {
                  void query.refetch();
                }}
              />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={keyOf}
              contentContainerStyle={[
                s.list,
                keyboard.visible ? { paddingBottom: keyboard.bottom + 16 } : null,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onTouchStart={Keyboard.dismiss}
              onScrollBeginDrag={Keyboard.dismiss}
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (!query.hasNextPage || query.isFetchingNextPage) return;
                void query.fetchNextPage();
              }}
              renderItem={({ item }) => renderRow(item, close)}
              ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
              ListFooterComponent={
                query.isFetchingNextPage ? (
                  <View style={{ paddingVertical: 12 }}>
                    <ActivityIndicator />
                  </View>
                ) : total > 0 ? (
                  <Text style={[s.empty, { paddingTop: 8 }]}>Ukupno: {total}</Text>
                ) : null
              }
            />
          )}

          {!!renderFooter ? (
            <View style={s.footer}>
              {renderFooter(close)}
            </View>
          ) : null}
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
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    padding: 14,
    backgroundColor: Colors.bg,
  },
});
