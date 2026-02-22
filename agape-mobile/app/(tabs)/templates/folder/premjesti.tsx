import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import NavigationHeader from "../../../../components/NavigationHeader";

import { FolderPicker } from "@/components/FolderPicker";
import { useTemplateFolders, useMoveFolder } from "@/app/api/hooks/templates/useDispatchTemplates";

type FolderLike = {
  id: number;
  name?: string | null;
  parentId?: number | null;
};

function buildChildrenIndex(folders: FolderLike[]) {
  const kids = new Map<number | null, number[]>();
  for (const f of folders) {
    const id = Number(f.id);
    if (!Number.isFinite(id)) continue;
    const pid = f.parentId == null ? null : Number(f.parentId);
    const arr = kids.get(pid) ?? [];
    arr.push(id);
    kids.set(pid, arr);
  }
  return kids;
}

function computeDescendants(folderId: number, children: Map<number | null, number[]>) {
  const out = new Set<number>();
  const stack = [folderId];
  while (stack.length) {
    const cur = stack.pop()!;
    const arr = children.get(cur) ?? [];
    for (const k of arr) {
      if (!out.has(k)) {
        out.add(k);
        stack.push(k);
      }
    }
  }
  return out;
}

export default function PremjestiFolder() {
  const params = useLocalSearchParams<{ folderId?: string; id?: string }>();

  // ✅ prihvati folderId (i toleriraj id ako si negdje krivo slao)
  const folderIdRaw = (params.folderId ?? params.id ?? "").toString();
  const folderId = Number(folderIdRaw);
  const hasValidId = Number.isFinite(folderId) && folderId > 0;

  const foldersQ = useTemplateFolders();
  const moveM = useMoveFolder();

  const folders = (foldersQ.data ?? []) as any as FolderLike[];

  const folder = useMemo(() => {
    if (!hasValidId) return null;
    return folders.find((f) => Number(f.id) === folderId) ?? null;
  }, [folders, folderId, hasValidId]);

  const [targetParentId, setTargetParentId] = useState<number | null>(null);

  // init selection = current parent
  useEffect(() => {
    if (!folder) return;
    const pid = folder.parentId == null ? null : Number(folder.parentId);
    setTargetParentId(Number.isFinite(pid as any) ? (pid as any) : null);
  }, [folder?.id]);

  // exclude: self + descendants (da ne možeš premjestiti folder u sebe / dijete)
  const excludeIds = useMemo(() => {
    if (!hasValidId) return new Set<number>();
    const children = buildChildrenIndex(folders);
    const desc = computeDescendants(folderId, children);
    const set = new Set<number>([folderId, ...Array.from(desc)]);
    return set;
  }, [folders, folderId, hasValidId]);

  const currentLabel = useMemo(() => {
    if (!folder) return "—";
    const pid = folder.parentId == null ? null : Number(folder.parentId);
    if (pid == null) return "Root (bez mape)";
    const p = folders.find((x) => Number(x.id) === pid);
    return (p?.name ?? `Mapa #${pid}`) as string;
  }, [folder, folders]);

  const targetLabel = useMemo(() => {
    const id = targetParentId == null ? null : Number(targetParentId);
    if (id == null) return "Root (bez mape)";
    const f = folders.find((x) => Number(x.id) === id);
    return (f?.name ?? `Mapa #${id}`) as string;
  }, [targetParentId, folders]);

  const err =
    (!hasValidId ? "Nedostaje parametar mape (folderId)." : null) ||
    (foldersQ.error as any)?.message ||
    (moveM.error as any)?.message ||
    null;

  const canSubmit = hasValidId && !!folder && !moveM.isPending;

  return (
    <Screen>
      <NavigationHeader
        title="Premjesti mapu"
        subtitle={hasValidId ? `#${folderId}` : "—"}
        fallbackHref="/(tabs)/templates"
      />

      {/* ✅ bitno: flex:1 + minHeight:0 da FolderPicker FlatList može scrollati do dna */}
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        {!hasValidId ? (
          <Text style={s.loading}>Neispravan parametar.</Text>
        ) : !folder ? (
          <Text style={s.loading}>{foldersQ.isLoading ? "Učitavam…" : "Mapa ne postoji."}</Text>
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
                title="Odaberi odredišnu mapu"
                folders={folders as any}
                selectedId={targetParentId}
                onSelect={setTargetParentId}
                allowRoot
                rootLabel="Root (bez mape)"
                excludeIds={excludeIds}
              />
            </View>

            <View style={s.actions}>
              <Pressable
                style={[s.primary, !canSubmit && { opacity: 0.6 }]}
                disabled={!canSubmit}
                onPress={async () => {
                  const target = targetParentId == null ? null : Number(targetParentId);

                  await moveM.mutateAsync({
                    folderId,
                    payload: { targetParentId: target },
                  });

                  router.back();
                }}
              >
                <Text style={s.primaryText}>{moveM.isPending ? "Premještam…" : "Premjesti"}</Text>
              </Pressable>

              <Pressable
                style={[s.secondary, moveM.isPending && { opacity: 0.6 }]}
                onPress={() => router.back()}
                disabled={moveM.isPending}
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
  container: { flex: 1, padding: 14, gap: 12 },
  body: { flex: 1, gap: 12 },

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

  // ✅ critical
  pickerWrap: { flex: 1, minHeight: 0 },

  actions: { gap: 10, paddingBottom: 2 },

  primary: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
