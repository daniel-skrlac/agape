import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { Banner } from "@/components/Banner";
import Colors from "@/constants/Colors";
import TemplatesHeader from "../../TemplatesHeader";

import { useTemplate, useTemplateFolders, useUpdateTemplate } from "@/app/api/hooks/useDispatchTemplates";

const MAX_W = 560;

export default function UrediPredlozak() {
  // ✅ IMPORTANT: route param is usually "id" when using /[id]/... routes
  const params = useLocalSearchParams<{ id?: string; templateId?: string }>();
  const templateId = Number(params.id ?? params.templateId);

  const tQ = useTemplate(templateId);
  const updM = useUpdateTemplate();

  // ✅ Option A: resolve folder name from folders list
  const foldersQ = useTemplateFolders();
  const folders = foldersQ.data ?? [];

  const t = tQ.data;

  const folderLabel = useMemo(() => {
    if (!t) return "Bez mape";

    // backend can return null folderId, generated TS might say number -> guard with (as any)
    const fid = (t as any).folderId ?? null;
    if (fid == null) return "Bez mape";

    const f = folders.find((x: any) => Number(x.id) === Number(fid));
    return f?.name ?? "Mapa";
  }, [t, folders]);

  const [name, setName] = useState("");
  const [hh, setHh] = useState(""); // ✅ no prefill until template loads
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!t) return;
    setName(t.name ?? "");
    setHh(t.householdSize == null ? "" : String(t.householdSize)); // ✅ keep empty if null
    setDesc(t.description ?? "");
  }, [t?.id]);

  const hhNum = useMemo(() => {
    const n = Number(hh.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [hh]);

  const err =
    (updM.error as any)?.message ||
    (tQ.error as any)?.message ||
    (foldersQ.error as any)?.message ||
    null;

  return (
    <Screen>
      <TemplatesHeader title="Uredi predložak" subtitle={`#${templateId}`} fallbackHref="/(tabs)/templates" />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.name ?? `Predložak #${templateId}`}</Text>
              <Text style={s.cardSub}>Mapa: {folderLabel}</Text>

              <View style={s.actionsRow}>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: "rgba(249,115,22,0.16)" }]}
                  onPress={() => router.push(`/(tabs)/templates/template/${templateId}/premjesti`)}
                >
                  <Text style={s.actionText}>Premjesti</Text>
                </Pressable>

                <Pressable
                  style={[s.actionBtn, { backgroundColor: "rgba(249,115,22,0.16)" }]}
                  onPress={() => router.push(`/(tabs)/templates/template/${templateId}/kopiraj`)}
                >
                  <Text style={s.actionText}>Kopiraj</Text>
                </Pressable>
              </View>
            </View>

            <Text style={s.label}>Naziv</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Upiši naziv…"
              placeholderTextColor={Colors.sub}
              style={s.input}
            />

            <Text style={s.label}>Kućanstvo</Text>
            <TextInput
              value={hh}
              onChangeText={(v) => setHh(v.replace(/[^\d]/g, ""))} // ✅ digits only, keeps empty allowed
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={Colors.sub}
              style={s.input}
            />

            <Text style={s.label}>Opis (opcionalno)</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Upiši opis…"
              placeholderTextColor={Colors.sub}
              style={[s.input, { minHeight: 90 }]}
              multiline
            />

            <Pressable
              style={[s.primary, updM.isPending && { opacity: 0.6 }]}
              disabled={updM.isPending}
              onPress={async () => {
                const nm = name.trim();
                if (!nm) return;

                // ✅ validate household size (don’t silently default to 1)
                if (hhNum == null) return;

                await updM.mutateAsync({
                  id: templateId,
                  payload: {
                    name: nm,
                    householdSize: hhNum,
                    description: desc,
                  } as any,
                });

                router.back();
              }}
            >
              <Text style={s.primaryText}>{updM.isPending ? "Spremam…" : "Spremi"}</Text>
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

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  cardSub: { color: Colors.sub, fontWeight: "800" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
  },
  actionText: { fontWeight: "900", color: Colors.text },

  label: { fontWeight: "900", color: Colors.text },
  input: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  primary: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    marginTop: 6,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
});
