import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Sheet } from "./Sheet";
import { Banner } from "./Banner";
import Colors from "@/constants/Colors";

export type PageResult<T> = { items: T[]; page: number; size: number; total: number };

export function SearchPickerSheet<T>({
  visible,
  title,
  onClose,
  fetchPage,
  renderRow,
  keyOf,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  fetchPage: (args: { page: number; size: number; q: string }) => Promise<PageResult<T>>;
  renderRow: (item: T, close: () => void) => React.ReactElement | null; // ✅
  keyOf: (item: T) => string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canLoadMore = useMemo(() => data.length < total, [data.length, total]);

  async function load(reset: boolean) {
    try {
      setLoading(true);
      setErr(null);
      const p = reset ? 0 : page;
      const res = await fetchPage({ page: p, size, q: q.trim() });
      setTotal(res.total);
      setPage(res.page + 1);
      setData(reset ? res.items : [...data, ...res.items]);
    } catch (e: any) {
      setErr(e?.message ?? "Neuspješno dohvaćanje.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    setQ("");
    setPage(0);
    setData([]);
    setTotal(0);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Pretraži…"
        placeholderTextColor={Colors.sub}
        style={s.input}
      />

      {!!err && <Banner type="error" text={err} />}

      <FlatList
        data={data}
        keyExtractor={(x) => keyOf(x)}
        contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
        renderItem={({ item }) => renderRow(item, onClose) ?? null} // ✅
        onEndReached={() => {
          if (!loading && canLoadMore) load(false);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <View style={{ paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: Colors.sub, fontWeight: "700" }}>
              {loading ? "Učitavam…" : canLoadMore ? "Povuci za još…" : "Kraj"}
            </Text>
          </View>
        }
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },
});
