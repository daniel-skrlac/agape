import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";

import { useTemplate, useTemplateFolders, useCopyTemplate } from "@/app/api/hooks/useDispatchTemplates";
import { FolderPicker } from "@/components/FolderPicker";

const MAX_W = 560;

function readNumberParam(params: any, keys: string[]): number {
  for (const k of keys) {
    const v = params?.[k];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export default function KopirajPredlozak() {
  const params = useLocalSearchParams();
  const templateId = readNumberParam(params, ["id", "templateId"]);
  const hasValidId = Number.isFinite(templateId) && templateId > 0;

  const tQ = useTemplate(hasValidId ? templateId : -1);
  const foldersQ = useTemplateFolders();
  const copyM = useCopyTemplate();

  const t = tQ.data as any;
  const folders = (foldersQ.data ?? []) as any[];

  const [destFolderId, setDestFolderId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!t) return;
    setDestFolderId(t.folderId == null ? null : Number(t.folderId));
    setNewName(`${t.name ?? `Predložak #${templateId}`} - Copy`);
  }, [t?.id]);

  const err =
    (!hasValidId ? "Nedostaje parametar predloška (id)." : null) ||
    (tQ.error as any)?.message ||
    (foldersQ.error as any)?.message ||
    (copyM.error as any)?.message ||
    null;

  const canSave = useMemo(() => {
    return hasValidId && (newName ?? "").trim().length > 0 && !copyM.isPending;
  }, [hasValidId, newName, copyM.isPending]);

  return (
    <Screen>
      <NavigationHeader
        title="Kopiraj predložak"
        subtitle={hasValidId ? `#${templateId}` : "—"}
        fallbackHref="/(tabs)/templates"
      />

      {/* ✅ isti layout kao KopirajMapu */}
      <View style={s.page}>
        {!!err && <Banner type="error" text={err} />}

        {!hasValidId ? (
          <Text style={s.loading}>Neispravan parametar.</Text>
        ) : !t ? (
          <Text style={s.loading}>{tQ.isLoading ? "Učitavam…" : "Predložak nije pronađen."}</Text>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.title} numberOfLines={2}>
                {t.name ?? `Predložak #${templateId}`}
              </Text>
              <Text style={s.sub}>Odaberi mapu i naziv kopije.</Text>
            </View>

            <View style={s.form}>
              <Text style={s.label}>Naziv kopije</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Unesi naziv kopije…"
                placeholderTextColor={Colors.sub}
                style={s.input}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {/* ✅ middle takes remaining space */}
            <View style={s.pickerWrap}>
              <FolderPicker
                fill
                title="Odaberi mapu za kopiju"
                folders={folders as any}
                selectedId={destFolderId}
                onSelect={setDestFolderId}
                allowRoot
                rootLabel="Root (bez mape)"
              />
            </View>

            {/* ✅ footer naturally at bottom */}
            <View style={s.footer}>
              <Pressable
                style={[s.primary, (!canSave || copyM.isPending) && { opacity: 0.6 }]}
                disabled={!canSave || copyM.isPending}
                onPress={async () => {
                  const nm = (newName ?? "").trim();
                  await copyM.mutateAsync({
                    templateId,
                    payload: { folderId: destFolderId as any, newName: nm } as any,
                  });
                  router.back();
                }}
              >
                <Text style={s.primaryText}>{copyM.isPending ? "Kopiram…" : "Kopiraj"}</Text>
              </Pressable>

              <Pressable
                style={[s.secondary, copyM.isPending && { opacity: 0.6 }]}
                onPress={() => router.back()}
                disabled={copyM.isPending}
              >
                <Text style={s.secondaryText}>Odustani</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  // ✅ IDENTICAL approach as KopirajMapu
  page: { flex: 1, minHeight: 0, padding: 14, gap: 12 },

  loading: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  sub: { color: Colors.sub, fontWeight: "800" },

  form: { gap: 8 },
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

  pickerWrap: { flex: 1, minHeight: 0 },

  footer: { gap: 10 },

  primary: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
