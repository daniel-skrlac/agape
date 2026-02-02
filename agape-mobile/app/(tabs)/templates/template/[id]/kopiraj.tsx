import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import { Banner } from "@/components/Banner";
import Colors from "@/constants/Colors";
import TemplatesHeader from "../../TemplatesHeader";

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

  const tQ = useTemplate(Number.isFinite(templateId) ? templateId : -1);
  const foldersQ = useTemplateFolders();
  const copyM = useCopyTemplate();

  const t = tQ.data;
  const folders = foldersQ.data ?? [];

  const [destFolderId, setDestFolderId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!t) return;
    setDestFolderId((t.folderId ?? null) as any);
    setNewName(`${t.name ?? `Predložak #${templateId}`} - Copy`);
  }, [t?.id]);

  const err =
    (!Number.isFinite(templateId) ? "Nedostaje parametar predloška (id)." : null) ||
    (tQ.error as any)?.message ||
    (foldersQ.error as any)?.message ||
    (copyM.error as any)?.message ||
    null;

  const canSave = useMemo(() => (newName ?? "").trim().length > 0 && Number.isFinite(templateId), [newName, templateId]);

  return (
    <Screen>
      <TemplatesHeader title="Kopiraj predložak" subtitle={Number.isFinite(templateId) ? `#${templateId}` : ""} fallbackHref="/(tabs)/templates" />

      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!t ? (
          <Text style={s.loading}>Učitavam…</Text>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.title} numberOfLines={2}>{t.name ?? `Predložak #${templateId}`}</Text>
              <Text style={s.sub}>Odaberi mapu i naziv kopije.</Text>
            </View>

            <Text style={s.label}>Naziv kopije</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Unesi naziv kopije…"
              placeholderTextColor={Colors.sub}
              style={s.input}
            />

            <FolderPicker
              title="Odaberi mapu za kopiju"
              folders={folders as any}
              selectedId={destFolderId}
              onSelect={setDestFolderId}
              allowRoot
              rootLabel="Root (bez mape)"
            />

            <Pressable
              style={[s.primary, (!canSave || copyM.isPending) && { opacity: 0.6 }]}
              disabled={!canSave || copyM.isPending}
              onPress={async () => {
                const nm = newName.trim();
                await copyM.mutateAsync({
                  templateId,
                  payload: { folderId: destFolderId as any, newName: nm } as any,
                });
                router.back();
              }}
            >
              <Text style={s.primaryText}>{copyM.isPending ? "Kopiram…" : "Kopiraj"}</Text>
            </Pressable>

            <Pressable style={s.secondary} onPress={() => router.back()} disabled={copyM.isPending}>
              <Text style={s.secondaryText}>Odustani</Text>
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
    gap: 6,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  sub: { color: Colors.sub, fontWeight: "800" },
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
    justifyContent: "center",
    marginTop: 2,
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
