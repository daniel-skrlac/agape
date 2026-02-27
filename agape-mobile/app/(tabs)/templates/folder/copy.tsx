import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";

import { ErrorCard } from "@/components/ErrorCard";
import { FolderPicker } from "@/components/FolderPicker";

import { toUserMessage } from "@/app/api/apiClient";
import { useCopyFolder, useTemplateFolderTree } from "@/app/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type FolderLike = {
  id: number;
  name?: string | null;
  parentId?: number | null;
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

function buildDescendantsSet(folders: FolderLike[], rootId: number): Set<number> {
  const childrenByParent = new Map<number, number[]>();

  for (const folder of folders ?? []) {
    const parentId = folder.parentId == null ? null : Number(folder.parentId);
    if (parentId == null) continue;

    const arr = childrenByParent.get(parentId) ?? [];
    arr.push(Number(folder.id));
    childrenByParent.set(parentId, arr);
  }

  const out = new Set<number>();
  const stack = [rootId];

  while (stack.length) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) ?? [];

    for (const childId of children) {
      if (out.has(childId)) continue;
      out.add(childId);
      stack.push(childId);
    }
  }

  return out;
}

export default function CopyFolderScreen() {
  const params = useLocalSearchParams<{ folderId?: string; id?: string }>();

  const folderId = readNumberParam(params, ["folderId", "id"]);
  const hasValidId = Number.isFinite(folderId) && folderId > 0;

  const folderTreeQuery = useTemplateFolderTree({ enabled: hasValidId });
  const copyMutation = useCopyFolder();

  const folders = (folderTreeQuery.data ?? []) as FolderLike[];

  const sourceFolder = useMemo(
    () => folders.find((f) => Number(f.id) === folderId) ?? null,
    [folders, folderId]
  );

  const [targetParentId, setTargetParentId] = useState<number | null>(null);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [includeTemplates, setIncludeTemplates] = useState(true);

  useEffect(() => {
    if (!sourceFolder) return;

    const parentId = sourceFolder.parentId == null ? null : Number(sourceFolder.parentId);
    setTargetParentId(Number.isFinite(parentId as any) ? (parentId as number) : null);
  }, [sourceFolder?.id, sourceFolder?.parentId]);

  const excludeIds = useMemo(() => {
    const set = new Set<number>();

    if (!hasValidId) return set;

    set.add(folderId);

    for (const descendantId of buildDescendantsSet(folders, folderId)) {
      set.add(descendantId);
    }

    return set;
  }, [folders, folderId, hasValidId]);

  const topError = useMemo(() => {
    if (!hasValidId) return "Nedostaje parametar mape (folderId).";

    if (folderTreeQuery.error) {
      return toUserMessage(folderTreeQuery.error, "Greška prilikom učitavanja mapa.");
    }

    if (copyMutation.error) {
      return toUserMessage(copyMutation.error, "Greška prilikom kopiranja mape.");
    }

    return null;
  }, [hasValidId, folderTreeQuery.error, copyMutation.error]);

  const canSubmit = useMemo(() => {
    return (
      hasValidId &&
      !!sourceFolder &&
      !copyMutation.isPending &&
      (includeSubfolders || includeTemplates)
    );
  }, [hasValidId, sourceFolder, copyMutation.isPending, includeSubfolders, includeTemplates]);

  const showLoading = hasValidId && folderTreeQuery.isLoading && folders.length === 0;

  const handleRetry = async () => {
    copyMutation.reset();

    if (!hasValidId) return;

    await Promise.resolve(folderTreeQuery.refetch());
  };

  const handleCopy = async () => {
    if (!canSubmit) return;

    try {
      await copyMutation.mutateAsync({
        folderId,
        payload: {
          targetParentId: targetParentId as any,
          includeSubfolders,
          includeTemplates,
        } as any,
      });

      router.back();
    } catch {
    }
  };

  return (
    <Screen>
      <NavigationHeader
        title="Kopiraj mapu"
        subtitle={hasValidId ? `#${folderId}` : "—"}
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
        ) : !sourceFolder ? (
          <Text style={s.loading}>
            {folderTreeQuery.isFetching ? "Učitavam…" : "Mapa nije pronađena."}
          </Text>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.title} numberOfLines={2}>
                {sourceFolder.name ?? `Mapa #${folderId}`}
              </Text>
              <Text style={s.sub}>Odaberi gdje kopirati mapu i što uključiti.</Text>
            </View>

            <View style={s.pickerWrap}>
              <FolderPicker
                fill
                title="Odaberi odredišnu nad-mapu"
                folders={folders as any}
                selectedId={targetParentId}
                onSelect={setTargetParentId}
                excludeIds={excludeIds}
                allowRoot
                rootLabel="Root (kopiraj u root)"
              />
            </View>

            <View style={s.footer}>
              <View style={s.toggles}>
                <Pressable
                  style={[s.toggle, includeSubfolders && s.toggleActive, copyMutation.isPending && s.disabled]}
                  onPress={() => setIncludeSubfolders((v) => !v)}
                  disabled={copyMutation.isPending}
                >
                  <Text style={[s.toggleText, includeSubfolders && s.toggleTextActive]}>
                    Podmape: {includeSubfolders ? "DA" : "NE"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[s.toggle, includeTemplates && s.toggleActive, copyMutation.isPending && s.disabled]}
                  onPress={() => setIncludeTemplates((v) => !v)}
                  disabled={copyMutation.isPending}
                >
                  <Text style={[s.toggleText, includeTemplates && s.toggleTextActive]}>
                    Predlošci: {includeTemplates ? "DA" : "NE"}
                  </Text>
                </Pressable>
              </View>

              {!includeSubfolders && !includeTemplates ? (
                <Text style={s.helper}>Odaberi barem jednu opciju za kopiranje.</Text>
              ) : null}

              <Pressable
                style={[s.primary, (!canSubmit || copyMutation.isPending) && s.disabled]}
                disabled={!canSubmit || copyMutation.isPending}
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

  pickerWrap: {
    flex: 1,
    minHeight: 0,
  },

  footer: {
    gap: 10,
  },

  toggles: {
    gap: 10,
  },

  toggle: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  toggleActive: {
    backgroundColor: "rgba(249,115,22,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
  },

  toggleText: {
    fontWeight: "900",
    color: Colors.sub,
  },

  toggleTextActive: {
    color: Colors.text,
  },

  helper: {
    color: Colors.sub,
    fontWeight: "700",
    textAlign: "center",
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