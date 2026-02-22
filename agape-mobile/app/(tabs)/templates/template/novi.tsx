import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { useCreateTemplate } from "@/app/api/hooks/useDispatchTemplates";
import NavigationHeader from "../../../../components/NavigationHeader";

export default function NewTemplateScreen() {
  const params = useLocalSearchParams<{ folderId?: string; folderName?: string }>();

  const folderIdRaw = params.folderId;
  const folderId = useMemo(() => {
    if (!folderIdRaw || folderIdRaw === "null" || folderIdRaw === "undefined") return null;
    const n = Number(folderIdRaw);
    return Number.isFinite(n) ? n : null;
  }, [folderIdRaw]);

  const folderName = (params.folderName as string) ?? (folderId == null ? "Bez mape" : "Mapa");

  const createTemplateM = useCreateTemplate();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const targetLabel = folderId == null ? "Bez mape (root)" : folderName;

  return (
    <Screen>
      <NavigationHeader title="Novi predložak" subtitle={folderName ? `Mapa: ${folderName}` : "Root"} fallbackHref="/(tabs)/templates" />

      <View style={s.container}>
        {!!errMsg && <Banner type="error" text={errMsg} />}

        <View style={s.infoBox}>
          <FontAwesome name="folder" size={16} color={Colors.text} />
          <Text style={s.infoText}>Dodaje se u: <Text style={s.infoStrong}>{targetLabel}</Text></Text>
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Naziv predloška"
          placeholderTextColor={Colors.sub}
          style={s.input}
        />

        <TextInput
          value={householdSize}
          onChangeText={setHouseholdSize}
          placeholder="Kućanstvo (npr. 1)"
          keyboardType="number-pad"
          placeholderTextColor={Colors.sub}
          style={s.input}
        />

        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="Opis (opcionalno)"
          placeholderTextColor={Colors.sub}
          style={[s.input, { minHeight: 90 }]}
          multiline
        />

        <Pressable
          style={[s.primary, createTemplateM.isPending && { opacity: 0.7 }]}
          disabled={createTemplateM.isPending}
          onPress={async () => {
            try {
              const nm = name.trim();
              if (!nm) return;

              const hs = Number(householdSize);
              if (!Number.isFinite(hs) || hs <= 0) {
                setErrMsg("Kućanstvo mora biti broj > 0.");
                return;
              }

              setErrMsg(null);

              const created = await createTemplateM.mutateAsync({
                // ✅ backend prihvaća null; TS model možda kaže number → cast
                folderId: (folderId as any) ?? null,
                householdSize: hs,
                name: nm,
                description: desc?.trim() ?? "",
              } as any);

              // created ima .id
              router.replace({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(created.id) } });
            } catch (e: any) {
              setErrMsg(e?.message ?? "Greška pri kreiranju predloška.");
            }
          }}
        >
          <Text style={s.primaryText}>{createTemplateM.isPending ? "Spremam…" : "Spremi predložak"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
  },
  infoText: { color: Colors.text, fontWeight: "800" },
  infoStrong: { color: Colors.text, fontWeight: "900" },

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

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
