import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../../components/NavigationHeader";
import Colors from "@/constants/Colors";

import { ErrorCard } from "@/components/ErrorCard";
import { FolderPicker } from "@/components/FolderPicker";
import InfoResultPopup from "@/components/InfoResultPopup";

import { toUserMessage } from "@/app/api/apiClient";
import {
  useCopyTemplate,
  useTemplateDetail,
  useTemplateFolderTree,
} from "@/app/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type CopyResultPopupState = {
  visible: boolean;
  copiedTemplateId: number | null;
  copiedTemplateName: string;
};

function readNumberParam(params: any, keys: string[]): number {
  for (const key of keys) {
    const raw = params?.[key];
    if (raw == null) continue;

    const value = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(value);

    if (Number.isFinite(n)) return n;
  }

  return NaN;
}

export default function CopyTemplateScreen() {
  const params = useLocalSearchParams();

  const templateId = readNumberParam(params, ["id", "templateId"]);
  const hasValidId = Number.isFinite(templateId) && templateId > 0;

  const templateQuery = useTemplateDetail(hasValidId ? templateId : null);
  const folderTreeQuery = useTemplateFolderTree({ enabled: hasValidId });
  const copyMutation = useCopyTemplate();

  const template = templateQuery.data as any;
  const folders = (folderTreeQuery.data ?? []) as any[];

  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [copyName, setCopyName] = useState("");

  const [resultPopup, setResultPopup] = useState<CopyResultPopupState>({
    visible: false,
    copiedTemplateId: null,
    copiedTemplateName: "",
  });

  useEffect(() => {
    if (!template) return;

    setTargetFolderId(template.folderId == null ? null : Number(template.folderId));

    const baseName = String(template.name ?? `Predložak #${templateId}`).trim();
    setCopyName(baseName ? `${baseName} - Copy` : `Predložak #${templateId} - Copy`);
  }, [template?.id, template?.folderId, template?.name, templateId]);

  const topError = useMemo(() => {
    if (!hasValidId) return "Nedostaje parametar predloška (id).";

    if (templateQuery.error) {
      return toUserMessage(templateQuery.error, "Greška prilikom učitavanja predloška.");
    }

    if (folderTreeQuery.error) {
      return toUserMessage(folderTreeQuery.error, "Greška prilikom učitavanja mapa.");
    }

    if (copyMutation.error) {
      return toUserMessage(copyMutation.error, "Greška prilikom kopiranja predloška.");
    }

    return null;
  }, [hasValidId, templateQuery.error, folderTreeQuery.error, copyMutation.error]);

  const canSave = useMemo(() => {
    return (
      hasValidId &&
      !!template &&
      !templateQuery.isLoading &&
      !folderTreeQuery.isLoading &&
      (copyName ?? "").trim().length > 0 &&
      !copyMutation.isPending
    );
  }, [
    hasValidId,
    template,
    templateQuery.isLoading,
    folderTreeQuery.isLoading,
    copyName,
    copyMutation.isPending,
  ]);

  const handleRetry = async () => {
    copyMutation.reset();

    if (!hasValidId) return;

    await Promise.all([
      Promise.resolve(templateQuery.refetch()),
      Promise.resolve(folderTreeQuery.refetch()),
    ]);
  };

  const closeResultPopup = useCallback(() => {
    setResultPopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCopy = async () => {
    const newName = (copyName ?? "").trim();
    if (!newName || !hasValidId) return;

    try {
      copyMutation.reset();

      const response = (await copyMutation.mutateAsync({
        templateId,
        payload: {
          folderId: targetFolderId as any,
          newName,
        } as any,
      })) as any;

      const copiedTemplateIdRaw = response?.id ?? response?.templateId ?? null;
      const copiedTemplateId = Number.isFinite(Number(copiedTemplateIdRaw))
        ? Number(copiedTemplateIdRaw)
        : null;

      const copiedTemplateName = String(response?.name ?? newName).trim() || newName;

      setResultPopup({
        visible: true,
        copiedTemplateId,
        copiedTemplateName,
      });
    } catch {
    }
  };

  const showLoading =
    hasValidId &&
    (templateQuery.isLoading || folderTreeQuery.isLoading) &&
    !template &&
    folders.length === 0;

  return (
    <Screen>
      <NavigationHeader
        title="Kopiraj predložak"
        subtitle={hasValidId ? `#${templateId}` : "—"}
        fallbackHref="/(tabs)/templates"
      />

      <View style={s.page}>
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Pokušaj ponovno"
            onAction={handleRetry}
            titleLines={1}
            messageLines={3}
          />
        )}

        {!hasValidId ? (
          <Text style={s.loading}>Neispravan parametar.</Text>
        ) : showLoading ? (
          <View style={s.centerBlock}>
            <ActivityIndicator />
            <Text style={s.loading}>Učitavam…</Text>
          </View>
        ) : !template ? (
          <Text style={s.loading}>{templateQuery.isFetching ? "Učitavam…" : "Predložak nije pronađen."}</Text>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.title} numberOfLines={2}>
                {template.name ?? `Predložak #${templateId}`}
              </Text>
              <Text style={s.sub}>Odaberi mapu i naziv kopije.</Text>
            </View>

            <View style={s.form}>
              <Text style={s.label}>Naziv kopije</Text>
              <TextInput
                value={copyName}
                onChangeText={setCopyName}
                placeholder="Unesi naziv kopije…"
                placeholderTextColor={Colors.sub}
                style={s.input}
                autoCorrect={false}
                autoCapitalize="none"
                editable={!copyMutation.isPending}
              />
            </View>

            <View style={s.pickerWrap}>
              <FolderPicker
                fill
                title="Odaberi mapu za kopiju"
                folders={folders as any}
                selectedId={targetFolderId}
                onSelect={setTargetFolderId}
                allowRoot
                rootLabel="Root (bez mape)"
              />
            </View>

            <View style={s.footer}>
              <Pressable
                style={[s.primary, (!canSave || copyMutation.isPending) && s.disabled]}
                disabled={!canSave || copyMutation.isPending}
                onPress={handleCopy}
              >
                <Text style={s.primaryText}>{copyMutation.isPending ? "Kopiram…" : "Kopiraj"}</Text>
              </Pressable>

              <Pressable
                style={[s.secondary, copyMutation.isPending && s.disabled]}
                disabled={copyMutation.isPending}
                onPress={() => router.back()}
              >
                <Text style={s.secondaryText}>Odustani</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <InfoResultPopup
        visible={resultPopup.visible}
        variant="success"
        title="Predložak kopiran"
        subtitle={
          resultPopup.copiedTemplateId
            ? `Kopija je kreirana kao #${resultPopup.copiedTemplateId}`
            : "Kopija je uspješno kreirana"
        }
        message={
          resultPopup.copiedTemplateName
            ? `Novi predložak: ${resultPopup.copiedTemplateName}`
            : "Predložak je uspješno kopiran."
        }
        linkText={
          resultPopup.copiedTemplateId
            ? `Otvori kopiju #${resultPopup.copiedTemplateId}`
            : "Otvori predloške"
        }
        buttonText="U redu"
        onClose={closeResultPopup}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    padding: 14,
    gap: 12,
  },

  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },

  loading: {
    color: Colors.sub,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },

  title: {
    fontWeight: "900",
    color: Colors.text,
    fontSize: 16,
  },

  sub: {
    color: Colors.sub,
    fontWeight: "800",
  },

  form: {
    gap: 8,
  },

  label: {
    fontWeight: "900",
    color: Colors.text,
  },

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

  pickerWrap: {
    flex: 1,
    minHeight: 0,
  },

  footer: {
    gap: 10,
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
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
  },

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

  secondaryText: {
    fontWeight: "900",
    color: Colors.text,
  },

  disabled: {
    opacity: 0.6,
  },
});