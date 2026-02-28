import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { FolderPicker } from "@/components/FolderPicker";

import { toUserMessage } from "../../../../src/api/apiClient";
import { useMoveFolder, useTemplateFolderTree } from "../../../../src/api/hooks/templates/useDispatchTemplates";

const MAX_W = 560;

type Mode = "SVE" | "MOJI" | "DIJELJENI";

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

function readNullableNumberParam(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw == null) return null;

  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readStringParam(v: unknown): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "").trim();
  return s ? s : null;
}

function readModeParam(v: unknown): Mode {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "MOJI" || s === "DIJELJENI") return s;
  return "SVE";
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
  const params = useLocalSearchParams<{
    folderId?: string;
    id?: string;

    parentFolderId?: string;
    parentFolderName?: string;
    mode?: string;
  }>();

  const folderId = readNumberParam(params, ["folderId", "id"]);
  const hasValidId = Number.isFinite(folderId) && folderId > 0;

  const parentFolderId = readNullableNumberParam(params.parentFolderId);
  const parentFolderName = readStringParam(params.parentFolderName) ?? "Mapa";
  const mode = readModeParam(params.mode);

  const backHref = useMemo(() => {
    if (parentFolderId != null && Number.isFinite(parentFolderId) && parentFolderId > 0) {
      return {
        pathname: "/(tabs)/templates/folder/[folderId]" as const,
        params: { folderId: String(parentFolderId), folderName: parentFolderName, mode },
      };
    }
    return "/(tabs)/templates" as const;
  }, [parentFolderId, parentFolderName, mode]);

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

  const currentParentId = useMemo(() => {
    if (!folder) return null;
    const id = folder.parentId == null ? null : Number(folder.parentId);
    return Number.isFinite(id as any) ? (id as number) : null;
  }, [folder?.parentId]);

  const sameTarget = useMemo(() => {
    const a = currentParentId == null ? null : Number(currentParentId);
    const b = targetParentId == null ? null : Number(targetParentId);
    return a === b;
  }, [currentParentId, targetParentId]);

  const currentLabel = useMemo(() => {
    if (!folder) return "—";
    if (currentParentId == null) return "Root (bez mape)";

    const parentFolder = folders.find((x) => Number(x.id) === currentParentId);
    return String(parentFolder?.name ?? `Mapa #${currentParentId}`);
  }, [folder, folders, currentParentId]);

  const targetLabel = useMemo(() => {
    const id = targetParentId == null ? null : Number(targetParentId);
    if (id == null) return "Root (bez mape)";

    const targetFolder = folders.find((x) => Number(x.id) === id);
    return String(targetFolder?.name ?? `Mapa #${id}`);
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
    return (
      hasValidId &&
      !!folder &&
      !folderTreeQuery.isLoading &&
      !moveMutation.isPending &&
      !sameTarget
    );
  }, [hasValidId, folder, folderTreeQuery.isLoading, moveMutation.isPending, sameTarget]);

  const handleRetry = async () => {
    moveMutation.reset();
    if (!hasValidId) return;
    await Promise.resolve(folderTreeQuery.refetch());
  };

  const goBack = useCallback(() => {
    if (typeof backHref === "string") router.replace(backHref);
    else router.replace(backHref);
  }, [backHref]);

  const handleMove = async () => {
    if (!canSubmit || !hasValidId || !folder) return;

    try {
      await moveMutation.mutateAsync({
        folderId,
        payload: { targetParentId: targetParentId == null ? null : Number(targetParentId) },
      });

      goBack();
    } catch {
    }
  };

  const showLoading =
    hasValidId && folderTreeQuery.isLoading && !folder && (folders?.length ?? 0) === 0;

  return (
    <Screen>
      <NavigationHeader
        title="Premjesti mapu"
        subtitle={hasValidId ? `#${folderId}` : "—"}
        fallbackHref={backHref}
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

              {sameTarget ? (
                <Text style={s.helper}>Mapa je već u odabranom parentu. Odaberi drugi ili Root.</Text>
              ) : null}
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
                onPress={goBack}
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

  helper: {
    marginTop: 4,
    color: Colors.sub,
    fontWeight: "700",
    fontSize: 12,
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