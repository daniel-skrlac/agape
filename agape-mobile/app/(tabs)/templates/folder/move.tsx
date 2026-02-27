import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { FolderPicker } from "@/components/FolderPicker";

import { toUserMessage } from "@/app/api/apiClient";
import { useMoveFolder, useTemplateFolderTree } from "@/app/api/hooks/templates/useDispatchTemplates";

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

function buildChildrenIndex(folders: FolderLike[]) {
  const map = new Map<number, number[]>();

  for (const folder of folders ?? []) {
    const id = Number(folder.id);
    if (!Number.isFinite(id)) continue;

    const parentId = folder.parentId == null ? null : Number(folder.parentId);
    if (parentId == null || !Number.isFinite(parentId)) continue;

    const list = map.get(parentId) ?? [];
    list.push(id);
    map.set(parentId, list);
  }

  return map;
}

function computeDescendants(rootFolderId: number, childrenIndex: Map<number, number[]>) {
  const descendants = new Set<number>();
  const stack = [rootFolderId];

  while (stack.length) {
    const current = stack.pop()!;
    const children = childrenIndex.get(current) ?? [];

    for (const childId of children) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      stack.push(childId);
    }
  }

  return descendants;
}

export default function MoveFolderScreen() {
  const params = useLocalSearchParams<{ folderId?: string; id?: string }>();

  const folderId = readNumberParam(params, ["folderId", "id"]);
  const hasValidId = Number.isFinite(folderId) && folderId > 0;

  const folderTreeQuery = useTemplateFolderTree({ enabled: hasValidId });
  const moveMutation = useMoveFolder();

  const folders = (folderTreeQuery.data ?? []) as FolderLike[];

  const folder = useMemo(() => {
    if (!hasValidId) return null;
    return folders.find((f) => Number(f.id) === folderId) ?? null;
  }, [folders, folderId, hasValidId]);

  const [targetParentId, setTargetParentId] = useState<number | null>(null);

  useEffect(() => {
    if (!folder) return;

    const currentParentId = folder.parentId == null ? null : Number(folder.parentId);
    setTargetParentId(Number.isFinite(currentParentId as number) ? (currentParentId as number) : null);
  }, [folder?.id, folder?.parentId]);

  const excludeIds = useMemo(() => {
    const set = new Set<number>();
    if (!hasValidId) return set;

    set.add(folderId);

    const childrenIndex = buildChildrenIndex(folders);
    const descendants = computeDescendants(folderId, childrenIndex);

    for (const id of descendants) set.add(id);

    return set;
  }, [folders, folderId, hasValidId]);

  const currentLabel = useMemo(() => {
    if (!folder) return "—";

    const currentParentId = folder.parentId == null ? null : Number(folder.parentId);
    if (currentParentId == null) return "Root (bez mape)";

    const parentFolder = folders.find((x) => Number(x.id) === currentParentId);
    return (parentFolder?.name ?? `Mapa #${currentParentId}`) as string;
  }, [folder, folders]);

  const targetLabel = useMemo(() => {
    const id = targetParentId == null ? null : Number(targetParentId);
    if (id == null) return "Root (bez mape)";

    const targetFolder = folders.find((x) => Number(x.id) === id);
    return (targetFolder?.name ?? `Mapa #${id}`) as string;
  }, [targetParentId, folders]);

  const topError = useMemo(() => {
    if (!hasValidId) return "Nedostaje parametar mape (folderId).";

    if (folderTreeQuery.error) {
      return toUserMessage(folderTreeQuery.error, "Greška prilikom učitavanja mapa.");
    }

    if (moveMutation.error) {
      return toUserMessage(moveMutation.error, "Greška prilikom premještanja mape.");
    }

    return null;
  }, [hasValidId, folderTreeQuery.error, moveMutation.error]);

  const canSubmit = useMemo(() => {
    return hasValidId && !!folder && !folderTreeQuery.isLoading && !moveMutation.isPending;
  }, [hasValidId, folder, folderTreeQuery.isLoading, moveMutation.isPending]);

  const handleRetry = async () => {
    moveMutation.reset();

    if (!hasValidId) return;

    await Promise.resolve(folderTreeQuery.refetch());
  };

  const handleMove = async () => {
    if (!hasValidId || !folder) return;

    try {
      await moveMutation.mutateAsync({
        folderId,
        payload: {
          targetParentId: targetParentId == null ? null : Number(targetParentId),
        },
      });

      router.back();
    } catch {
    }
  };

  const showLoading =
    hasValidId &&
    folderTreeQuery.isLoading &&
    !folder &&
    (folders?.length ?? 0) === 0;

  return (
    <Screen>
      <NavigationHeader
        title="Premjesti mapu"
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
        ) : !folder ? (
          <Text style={s.loading}>
            {folderTreeQuery.isFetching ? "Učitavam…" : "Mapa ne postoji."}
          </Text>
        ) : (
          <View style={s.body}>
            <View style={s.card}>
              <Text style={s.title} numberOfLines={2}>
                {folder.name ?? `Mapa #${folderId}`}
              </Text>
              <Text style={s.sub}>Trenutno: {currentLabel}</Text>
              <Text style={s.sub}>Odredište: {targetLabel}</Text>
            </View>

            <View style={s.pickerWrap}>
              <FolderPicker
                fill
                title="Odaberi odredišnu mapu"
                folders={folders as any}
                selectedId={targetParentId}
                onSelect={setTargetParentId}
                allowRoot
                rootLabel="Root (bez mape)"
                excludeIds={excludeIds}
              />
            </View>

            <View style={s.footer}>
              <Pressable
                style={[s.primary, (!canSubmit || moveMutation.isPending) && s.disabled]}
                disabled={!canSubmit || moveMutation.isPending}
                onPress={handleMove}
              >
                <Text style={s.primaryText}>
                  {moveMutation.isPending ? "Premještam…" : "Premjesti"}
                </Text>
              </Pressable>

              <Pressable
                style={[s.secondary, moveMutation.isPending && s.disabled]}
                disabled={moveMutation.isPending}
                onPress={() => router.back()}
              >
                <Text style={s.secondaryText}>Odustani</Text>
              </Pressable>
            </View>
          </View>
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

  body: {
    flex: 1,
    minHeight: 0,
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
    paddingBottom: 2,
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