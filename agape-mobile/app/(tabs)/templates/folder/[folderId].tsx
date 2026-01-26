import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { useTemplateList } from "@/app/api/hooks/useDispatchTemplates";
import { Swipeable } from "react-native-gesture-handler";

type Mode = "SVE" | "MOJI" | "DIJELJENI";

function accent(mode: Mode) {
  if (mode === "SVE") return { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.28)", text: "#2563EB" };
  if (mode === "DIJELJENI") return { bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.26)", text: "#7C3AED" };
  return { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.28)", text: Colors.orange };
}

export default function TemplatesFolderScreen() {
  const params = useLocalSearchParams<{ folderId: string; folderName?: string; mode?: Mode }>();
  const folderId = Number(params.folderId);
  const folderName = (params.folderName as string) ?? "Mapa";
  const mode = (params.mode as Mode) ?? "SVE";

  const [q, setQ] = useState("");

  const includeShared = mode !== "MOJI";

  const templatesQ = useTemplateList({
    folderId,
    q,
    includeShared,
    rootOnly: false,
  });

  const a = accent(mode);
  const errText = (templatesQ.error as any)?.message || null;
  const templates = templatesQ.data ?? [];

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10 }}>
        <View style={s.titleRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={[s.backBtn, { backgroundColor: a.bg, borderColor: a.border }]}>
            <FontAwesome name="chevron-left" size={14} color={a.text} />
          </Pressable>
          <Text style={s.h1}>{folderName}</Text>
        </View>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pretraži u mapi…"
          placeholderTextColor={Colors.sub}
          style={s.search}
        />
      </View>
    );
  }, [q, folderName, a.bg, a.border, a.text]);

  return (
    <Screen>
      <View style={s.container}>
        {!!errText && <Banner type="error" text={errText} />}

        {header}

        <FlatList
          data={templates}
          keyExtractor={(t: any) => String(t.id)}
          refreshing={templatesQ.isFetching}
          onRefresh={() => templatesQ.refetch()}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}

          renderItem={({ item }: any) => {
            const canEdit = !item.shared;   // po želji: shared ne možeš uređivati
            const canDelete = !item.shared; // po želji: shared ne možeš brisati

            return (
              <Swipeable
                overshootRight={false}
                friction={2}
                rightThreshold={40}
                renderRightActions={() => (
                  <View style={sw.actions}>
                    {canEdit && (
                      <Pressable
                        style={[sw.actionBtn, sw.edit]}
                        onPress={() => {
                          // TODO: promijeni rutu ako imaš poseban edit screen
                          router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id), edit: "1" } });
                        }}
                      >
                        <FontAwesome name="pencil" size={16} color={Colors.text} />
                        <Text style={sw.actionText}>Uredi</Text>
                      </Pressable>
                    )}

                    {canDelete && (
                      <Pressable
                        style={[sw.actionBtn, sw.delete]}
                        onPress={() => {
                          // 👉 ovdje pozovi tvoj confirm modal / sheet
                          setTplDeleteId(item.id);
                          setTplDeleteLabel(item.name);
                          setTplDeleteOpen(true);
                        }}
                      >
                        <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                        <Text style={[sw.actionText, { color: Colors.dangerText }]}>Obriši</Text>
                      </Pressable>
                    )}

                    {/* ako je shared, možeš pokazati Copy umjesto delete/edit */}
                    {item.shared && (
                      <Pressable
                        style={[sw.actionBtn, sw.copy]}
                        onPress={() => {
                          // npr. copy template flow
                          setCopyTemplateId(item.id);
                          setCopyOpen(true);
                        }}
                      >
                        <FontAwesome name="copy" size={16} color={Colors.text} />
                        <Text style={sw.actionText}>Kopiraj</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/templates/template/[id]",
                      params: { id: String(item.id) },
                    })
                  }
                  style={[
                    s.card,
                    item.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null,
                  ]}
                >
                  <View style={s.row}>
                    <View style={[s.iconCircle, item.shared ? { backgroundColor: "rgba(59,130,246,0.12)" } : null]}>
                      <FontAwesome
                        name={item.shared ? "share-alt" : "file-text-o"}
                        size={16}
                        color={item.shared ? Colors.sharedText : Colors.text}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={s.title}>{item.name}</Text>
                        {item.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
                      </View>
                      <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text>
                      {!!item.description && (
                        <Text style={s.desc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>

                    <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                  </View>
                </Pressable>
              </Swipeable>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>{templatesQ.isLoading ? "Učitavam…" : "Nema predložaka u mapi."}</Text>}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 18, fontWeight: "900", color: Colors.text },

  search: { backgroundColor: Colors.bg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "800", color: Colors.text },

  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "900", color: Colors.text },
  badge: { fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.sharedBg, color: Colors.sharedText },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },
  empty: { textAlign: "center", color: Colors.sub, marginTop: 20, fontWeight: "800" },
});

