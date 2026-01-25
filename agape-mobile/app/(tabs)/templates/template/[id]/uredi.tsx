import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { useTemplate, useTemplateFolders, useUpdateTemplate } from "@/app/api/hooks/useDispatchTemplates";
import { Banner } from "@/components/Banner";
import { Chip } from "@/components/Chip";
import Colors from "@/constants/Colors";

export default function UrediPredlozak() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const tQ = useTemplate(id);
  const foldersQ = useTemplateFolders();
  const updM = useUpdateTemplate();

  const t = tQ.data;
  const folders = foldersQ.data ?? [];

  const [folderId, setFolderId] = useState<number | null>(t?.folderId ?? null);
  const [name, setName] = useState(t?.name ?? "");
  const [hh, setHh] = useState(String(t?.householdSize ?? 1));
  const [desc, setDesc] = useState(t?.description ?? "");

  // sync once loaded
  React.useEffect(() => {
    if (!t) return;
    setFolderId(t.folderId ?? null);
    setName(t.name ?? "");
    setHh(String(t.householdSize ?? 1));
    setDesc(t.description ?? "");
  }, [t?.id]);

  const hhNum = useMemo(() => {
    const n = Number(hh);
    return Number.isFinite(n) ? n : 1;
  }, [hh]);

  const err = (updM.error as any)?.message || (tQ.error as any)?.message || null;

  return (
    <Screen>
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <Text style={s.label}>Mapa</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Bez mape" active={folderId === null} onPress={() => setFolderId(null)} />
              {folders.map(f => (
                <Chip key={f.id} label={f.name} active={folderId === f.id} onPress={() => setFolderId(f.id)} />
              ))}
            </View>

            <Text style={s.label}>Naziv</Text>
            <TextInput value={name} onChangeText={setName} style={s.input} />

            <Text style={s.label}>Kućanstvo</Text>
            <TextInput value={hh} onChangeText={setHh} keyboardType="number-pad" style={s.input} />

            <Text style={s.label}>Opis (opcionalno)</Text>
            <TextInput value={desc} onChangeText={setDesc} style={[s.input, { minHeight: 90 }]} multiline />

            <Pressable
              style={[s.primary, updM.isPending && { opacity: 0.6 }]}
              disabled={updM.isPending}
              onPress={async () => {
                const nm = name.trim();
                if (!nm) return;
                await updM.mutateAsync({
                  id,
                  payload: {
                    folderId: folderId as any,
                    householdSize: hhNum,
                    name: nm,
                    description: desc,
                  } as any,
                });
                router.back();
              }}
            >
              <Text style={s.primaryText}>Spremi</Text>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },
  label: { fontWeight: "900", color: Colors.text },
  input: { backgroundColor: Colors.bg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "800", color: Colors.text },
  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontWeight: "900" },
});
