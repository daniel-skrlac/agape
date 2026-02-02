import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/Colors";

type FolderLike = {
  id: number;
  name?: string | null;
  parentId?: number | null;
};

function norm(v: any) {
  return (v ?? "").toString().trim().toLowerCase();
}

function asExcludeSet(excludeIds?: Set<number> | number[] | null) {
  if (!excludeIds) return new Set<number>();
  if (excludeIds instanceof Set) return new Set<number>(Array.from(excludeIds).map((x) => Number(x)));
  return new Set<number>((excludeIds ?? []).map((x) => Number(x)));
}

function buildPath(byId: Map<number, FolderLike>, id: number): string {
  const parts: string[] = [];
  let cur: FolderLike | undefined = byId.get(id);
  let guard = 0;

  while (cur && guard++ < 50) {
    const nm = (cur.name ?? "").trim();
    if (nm) parts.push(nm);
    const pid = cur.parentId == null ? null : Number(cur.parentId);
    if (pid == null) break;
    cur = byId.get(pid);
  }

  return parts.length ? `Root › ${parts.reverse().join(" › ")}` : "Root";
}

type Row = { id: number; name: string; depth: number; path: string };

export function FolderPicker(props: {
  title: string;
  folders: FolderLike[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;

  allowRoot?: boolean;
  rootLabel?: string;
  excludeIds?: Set<number> | number[];

  /**
   * Koliko px je "prekriveno" na dnu (npr. gumbi u sheet-u).
   * Ne uključuje safe-area — to dodajemo automatski.
   */
  bottomInset?: number;

  /** dodatni padding (ako želiš malo zraka) */
  extraBottomPadding?: number;
}) {
  const {
    title,
    folders,
    selectedId,
    onSelect,
    allowRoot = false,
    rootLabel = "Root (bez mape)",
    excludeIds,
    bottomInset = 0,
    extraBottomPadding = 16,
  } = props;

  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const { rows, parentOf } = useMemo(() => {
    const byId = new Map<number, FolderLike>();
    for (const f of folders ?? []) if (f?.id != null) byId.set(Number(f.id), f);

    const excluded = asExcludeSet(excludeIds);

    const parentOf = new Map<number, number | null>();
    for (const f of folders ?? []) {
      if (!f?.id) continue;
      parentOf.set(Number(f.id), f.parentId == null ? null : Number(f.parentId));
    }

    const children = new Map<number | null, FolderLike[]>();
    for (const f of folders ?? []) {
      if (!f?.id || excluded.has(Number(f.id))) continue;
      const pid = f.parentId == null ? null : Number(f.parentId);
      const arr = children.get(pid) ?? [];
      arr.push(f);
      children.set(pid, arr);
    }

    for (const [pid, arr] of children.entries()) {
      arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "hr", { sensitivity: "base" }));
      children.set(pid, arr);
    }

    const out: Row[] = [];
    const walk = (pid: number | null, depth: number) => {
      const arr = children.get(pid) ?? [];
      for (const f of arr) {
        const id = Number(f.id);
        const name = (f.name ?? "").trim() || `Mapa #${id}`;
        const path = buildPath(byId, id);
        out.push({ id, name, depth, path });
        walk(id, depth + 1);
      }
    };
    walk(null, 0);

    return { rows: out, parentOf };
  }, [folders, excludeIds]);

  const model: Row[] = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;

    const keep = new Set<number>();

    for (const r of rows) {
      const hit =
        norm(r.name).includes(needle) ||
        norm(r.path).includes(needle) ||
        String(r.id).includes(needle);

      if (!hit) continue;

      keep.add(r.id);

      let p = parentOf.get(r.id) ?? null;
      let guard = 0;
      while (p != null && guard++ < 50) {
        keep.add(p);
        p = parentOf.get(p) ?? null;
      }
    }

    return rows.filter((r) => keep.has(r.id));
  }, [rows, q, parentOf]);

  const showBreadcrumb = (q ?? "").trim().length > 0;

  // ✅ Dinamički bottom padding:
  // - bottomInset: visina gumba/overlaya iz parenta
  // - insets.bottom: safe area (iPhone)
  // - extraBottomPadding: malo zraka
  const bottomSpace = Math.max(0, bottomInset) + (insets?.bottom ?? 0) + extraBottomPadding;

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.title}>{title}</Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Pretraži mape…"
        placeholderTextColor={Colors.sub}
        style={s.search}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {allowRoot && (
        <Pressable style={[s.row, selectedId == null && s.rowActive]} onPress={() => onSelect(null)}>
          <View style={s.rowLeft}>
            <View style={s.iconBox}>
              <FontAwesome name="folder" size={16} color={Colors.sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {rootLabel}
              </Text>
              {showBreadcrumb && (
                <Text style={s.path} numberOfLines={1}>
                  Root
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      )}

      <FlatList
        data={model}
        keyExtractor={(x) => String(x.id)}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        // ✅ Ovo je ključno: dovoljno paddinga da zadnja kartica bude skroz vidljiva
        contentContainerStyle={{
          gap: 10,
          paddingBottom: bottomSpace,
          flexGrow: 1,
        }}
        // ✅ dodatni footer (na Androidu zna pomoć više nego padding)
        ListFooterComponent={<View style={{ height: bottomSpace }} />}
        // ✅ iOS: contentInset + scrollIndicatorInset za “real” bottom safe area
        contentInset={{ bottom: Platform.OS === "ios" ? bottomSpace : 0 }}
        scrollIndicatorInsets={{ bottom: Platform.OS === "ios" ? bottomSpace : 0 }}
        renderItem={({ item }) => {
          const active = Number(selectedId) === item.id;
          const indent = Math.min(6 + item.depth * 14, 160);

          return (
            <Pressable style={[s.row, active && s.rowActive]} onPress={() => onSelect(item.id)}>
              <View style={[s.indentRail, { width: indent }]} />

              <View style={[s.rowLeft, { paddingLeft: indent }]}>
                <View style={s.iconBox}>
                  <FontAwesome name="folder" size={16} color={Colors.text} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {showBreadcrumb && (
                    <Text style={s.path} numberOfLines={1}>
                      {item.path}
                    </Text>
                  )}
                </View>

                <Text style={s.id}>#{item.id}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  search: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  row: {
    backgroundColor: Colors.bg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: 12,
    overflow: "hidden",
  },
  rowActive: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderColor: "rgba(249,115,22,0.35)",
  },

  indentRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(148,163,184,0.06)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },

  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  name: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  path: { color: Colors.sub, fontWeight: "800", marginTop: 2 },
  id: { color: Colors.sub, fontWeight: "900" },

  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", marginTop: 10 },
});
