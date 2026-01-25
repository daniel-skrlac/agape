import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { useCreateTemplate, useTemplateFolders } from "@/app/api/hooks/useDispatchTemplates";
import { Banner } from "@/components/Banner";
import { Chip } from "@/components/Chip";
import Colors from "@/constants/Colors";

export default function NoviPredlozak() {
  const params = useLocalSearchParams<{ folderId?: string }>();
  const foldersQ = useTemplateFolders();
  const createM = useCreateTemplate();

  const [name, setName] = useState("");
  const [hh, setHh] = useState("1");
  const [desc, setDesc] = useState("");

  const [folderId, setFolderId] = useState<number | null>(() => {
    if (!params.folderId || params.folderId === "null") return null;
    const n = Number(params.folderId);
    return Number.isFinite(n) ? n : null;
  });

  const folders = foldersQ.data ?? [];
  const err = (createM.error as any)?.message || null;

  const hhNum = useMemo(() => {
    const n = Number(hh);
    return Number.isFinite(n) ? n : 1;
  }, [hh]);

  return (
    <Screen>
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        <Text style={s.label}>Mapa</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Bez mape" active={folderId === null} onPress={() => setFolderId(null)} />
          {folders.map(f => (
            <Chip key={f.id} label={f.name} active={folderId === f.id} onPress={() => setFolderId(f.id)} />
          ))}
        </View>

        <Text style={s.label}>Naziv</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Naziv predloška" style={s.input} />

        <Text style={s.label}>Kućanstvo</Text>
        <TextInput value={hh} onChangeText={setHh} placeholder="npr. 4" keyboardType="number-pad" style={s.input} />

        <Text style={s.label}>Opis (opcionalno)</Text>
        <TextInput value={desc} onChangeText={setDesc} placeholder="Opis" style={[s.input, { minHeight: 90 }]} multiline />

        <Pressable
          style={[s.primary, createM.isPending && { opacity: 0.6 }]}
          disabled={createM.isPending}
          onPress={async () => {
            const nm = name.trim();
            if (!nm) return;

            const t = await createM.mutateAsync({
              folderId: folderId as any,
              householdSize: hhNum,
              name: nm,
              description: desc,
            } as any);

            router.replace({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(t.id) } });
          }}
        >
          <Text style={s.primaryText}>Spremi</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  label: { fontWeight: "900", color: Colors.text },
  input: { backgroundColor: Colors.bg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "800", color: Colors.text },
  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontWeight: "900" },
});
