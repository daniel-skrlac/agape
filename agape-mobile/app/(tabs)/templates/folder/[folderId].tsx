import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "../../../../components/ui/Screen";
import type { TemplateResponseDTO } from "../../../models/generated";
import { useTemplateList } from "../../../api/hooks/useDispatchTemplates";


const ORANGE = "#F97316";
const BORDER = "rgba(2, 6, 23, 0.12)";

export default function TemplatesInFolderScreen() {
  const params = useLocalSearchParams<{ folderId: string; folderName?: string }>();
  const folderIdParam = params.folderId;
  const folderName = (params.folderName as string) ?? "Predlošci";

  const folderId: number | null = folderIdParam === "null" ? null : Number(folderIdParam);

  const [q, setQ] = useState("");
  const [includeShared, setIncludeShared] = useState(true);

  const allowShared = folderId == null;

  const templatesQ = useTemplateList({
    folderId,
    q,
    mode: allowShared ? (includeShared ? "SVE" : "MOJI") : "MOJI",
  });


  const data = templatesQ.data ?? [];

  const createNew = () => {
    router.push({
      pathname: "/(tabs)/templates/template/novi",
      params: {
        folderId: folderId == null ? "null" : String(folderId),
        folderName,
      },
    });
  };

  const openTemplate = (id: number) => {
    router.push({
      pathname: "/(tabs)/templates/template/[id]",
      params: { id: String(id) },
    });
  };

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10 }}>
        <Text style={s.h1}>{folderName}</Text>

        <View style={s.searchRow}>
          <TextInput value={q} onChangeText={setQ} placeholder="Pretraži po nazivu…" style={s.input} />
          <Pressable style={s.primaryBtn} onPress={createNew}>
            <FontAwesome name="plus" size={14} color="white" />
            <Text style={s.primaryBtnText}>Novi</Text>
          </Pressable>
        </View>

        {allowShared ? (
          <Pressable
            style={[s.toggle, includeShared ? s.toggleOn : s.toggleOff]}
            onPress={() => setIncludeShared((v) => !v)}
          >
            <FontAwesome
              name={includeShared ? "check-square" : "square-o"}
              size={16}
              color={includeShared ? ORANGE : "#64748B"}
            />
            <Text style={s.toggleText}>{includeShared ? "Uključeni dijeljeni" : "Samo moji"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }, [q, includeShared, allowShared, folderName]);

  return (
    <Screen>
      <View style={s.container}>
        {header}

        <FlatList
          data={data}
          keyExtractor={(x) => String(x.id)}
          refreshing={templatesQ.isFetching}
          onRefresh={() => templatesQ.refetch()}
          contentContainerStyle={{ gap: 10, paddingBottom: 36 }}
          renderItem={({ item }) => <TemplateRow item={item} onPress={() => openTemplate(item.id)} />}
          ListEmptyComponent={
            templatesQ.isLoading ? <Text style={s.muted}>Učitavam…</Text> : <Text style={s.muted}>Nema predložaka.</Text>
          }
        />
      </View>
    </Screen>
  );
}

function TemplateRow({ item, onPress }: { item: TemplateResponseDTO; onPress: () => void }) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.row}>
        <View style={[s.iconCircle, item.shared ? { backgroundColor: "rgba(59,130,246,0.12)" } : null]}>
          <FontAwesome name={item.shared ? "share-alt" : "file-text-o"} size={16} color={item.shared ? "#2563EB" : "#0F172A"} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.title}>{item.name}</Text>
            {item.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
          </View>
          <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text>
          {item.description ? (
            <Text style={s.desc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        <FontAwesome name="chevron-right" size={14} color="#64748B" />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: "900", color: "#0F172A" },

  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "700",
  },
  primaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtnText: { color: "white", fontWeight: "900" },

  toggle: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  toggleOn: { borderColor: "rgba(249,115,22,0.5)", backgroundColor: "rgba(249,115,22,0.08)" },
  toggleOff: { borderColor: BORDER, backgroundColor: "rgba(255,255,255,0.85)" },
  toggleText: { fontWeight: "900", color: "#0F172A" },

  card: {
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    color: "#1D4ED8",
  },
  sub: { marginTop: 2, color: "#64748B", fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },
  muted: { textAlign: "center", color: "#64748B", marginTop: 16, fontWeight: "700" },
});
