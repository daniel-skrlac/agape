import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import { useCreateFolder, useDeleteFolder, useRenameFolder, useTemplateFolders, useTemplateList } from "@/app/api/hooks/useDispatchTemplates";
import { Banner } from "@/components/Banner";
import { Chip } from "@/components/Chip";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Segmented } from "@/components/Segmented";
import { Sheet } from "@/components/Sheet";
import Colors from "@/constants/Colors";

type Mode = "SVE" | "MOJI" | "DIJELJENI";

export default function TemplatesRoot() {
  const foldersQ = useTemplateFolders();
  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();

  // ✅ SVE default i prva opcija u segmented
  const [mode, setMode] = useState<Mode>("SVE");
  const [q, setQ] = useState("");
  const [folderId, setFolderId] = useState<number | null>(null);

  const folders = foldersQ.data ?? [];

  // root: folder chips samo za MOJI
  const canUseFolders = mode === "MOJI";

  const templatesQ = useTemplateList({ folderId: canUseFolders ? folderId : null, q, mode });
  const templates = templatesQ.data ?? [];

  const [addOpen, setAddOpen] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLabel, setDeleteLabel] = useState("");

  const errorText = (foldersQ.error as any)?.message || (templatesQ.error as any)?.message || null;

  const headerChips = useMemo(() => {
    if (!canUseFolders) return null;

    return (
      <View style={{ gap: 10 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          data={[
            { id: -999, name: "Sve" },
            { id: -1, name: "Bez mape" },
            ...folders.map((f) => ({ id: f.id, name: f.name })),
          ]}
          keyExtractor={(x) => String(x.id)}
          renderItem={({ item }) => {
            const isAll = item.id === -999;
            const isNone = item.id === -1;

            // NOTE: minimalno — "Bez mape" trenutno mapira na folderId=null (isto kao "Sve")
            // Ako želiš pravi filter "bez mape", treba backend param / drugačiji sentinel (mogu ti to složiti).
            const active = isAll ? folderId === null : isNone ? folderId === null : folderId === item.id;

            const onPress = () => {
              if (isAll) setFolderId(null);
              else if (isNone) setFolderId(null);
              else setFolderId(item.id);
            };

            const onLongPress = () => {
              if (isAll || isNone) return;
              setRenameId(item.id);
              setRenameName(item.name);
              setRenameOpen(true);
            };

            return <Chip label={item.name} active={active} onPress={onPress} onLongPress={onLongPress} />;
          }}
        />
        <Text style={s.helper}>Savjet: dugo pritisni mapu za preimenovanje. Brisanje je u izborniku “Dodaj”.</Text>
      </View>
    );
  }, [canUseFolders, folderId, folders]);

  const openDeleteFolder = (id: number, name: string) => {
    setDeleteId(id);
    setDeleteLabel(name);
    setDeleteOpen(true);
  };

  return (
    <Screen>
      <View style={s.container}>
        {!!errorText && <Banner type="error" text={errorText} />}

        {/* ✅ FIX TOP BAR: Segmented se smije stisnuti, Dodaj uvijek vidljiv/klikabilan */}
        <View style={s.topRow}>
          <View style={s.segmentWrap}>
            <Segmented<Mode>
              value={mode}
              options={[
                { value: "SVE", label: "Sve" }, // ✅ prvo
                { value: "MOJI", label: "Moji" },
                { value: "DIJELJENI", label: "Dijeljeni" },
              ]}
              onChange={(v) => {
                setMode(v);
                if (v !== "MOJI") setFolderId(null);
              }}
            />
          </View>

          <Pressable style={s.addBtn} onPress={() => setAddOpen(true)} hitSlop={8}>
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={s.addText}>Dodaj</Text>
          </Pressable>
        </View>

        <TextInput value={q} onChangeText={setQ} placeholder="Pretraži predloške…" style={s.search} />

        {headerChips}

        <FlatList
          data={templates}
          keyExtractor={(t) => String(t.id)}
          refreshing={templatesQ.isFetching}
          onRefresh={() => templatesQ.refetch()}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id) } })}
              style={[
                s.card,
                item.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null,
              ]}
            >
              <View style={s.row}>
                <View style={[s.iconCircle, item.shared ? { backgroundColor: "rgba(59,130,246,0.12)" } : null]}>
                  <FontAwesome
                    name={item.shared ? "share-alt" : "file-text-o"}
                    size={16}
                    color={item.shared ? Colors.sharedText : Colors.text}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={s.title}>{item.name}</Text>
                    {item.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
                  </View>
                  <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text>
                  {!!item.description && (
                    <Text style={s.desc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>

                <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={s.empty}>{templatesQ.isLoading ? "Učitavam…" : "Nema predložaka."}</Text>}
        />

        {/* ADD SHEET */}
        <Sheet visible={addOpen} title="Dodaj" onClose={() => setAddOpen(false)}>
          <Pressable
            style={s.action}
            onPress={() => {
              setAddOpen(false);
              setNewFolderOpen(true);
            }}
          >
            <FontAwesome name="folder" size={16} color={Colors.text} />
            <Text style={s.actionText}>Nova mapa</Text>
          </Pressable>

          <Pressable
            style={s.action}
            onPress={() => {
              setAddOpen(false);
              router.push({
                pathname: "/(tabs)/templates/novi",
                params: { folderId: canUseFolders ? (folderId ?? "null") : "null" },
              });
            }}
          >
            <FontAwesome name="file-text-o" size={16} color={Colors.text} />
            <Text style={s.actionText}>Novi predložak</Text>
          </Pressable>

          {canUseFolders && folders.length > 0 && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Text style={{ fontWeight: "900", color: Colors.text }}>Brisanje mape</Text>
              {folders.map((f) => (
                <Pressable
                  key={f.id}
                  style={[s.action, { backgroundColor: Colors.dangerBg }]}
                  onPress={() => {
                    setAddOpen(false);
                    openDeleteFolder(f.id, f.name);
                  }}
                >
                  <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                  <Text style={[s.actionText, { color: Colors.dangerText }]}>Obriši mapu: {f.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Sheet>

        {/* NEW FOLDER */}
        <Sheet visible={newFolderOpen} title="Nova mapa" onClose={() => setNewFolderOpen(false)}>
          <TextInput value={newFolderName} onChangeText={setNewFolderName} placeholder="Naziv mape" style={s.search} />
          <Pressable
            style={[s.primary, createFolderM.isPending && { opacity: 0.6 }]}
            disabled={createFolderM.isPending}
            onPress={async () => {
              const name = newFolderName.trim();
              if (!name) return;
              await createFolderM.mutateAsync({ parentId: null as any, name } as any);
              setNewFolderName("");
              setNewFolderOpen(false);
              foldersQ.refetch();
            }}
          >
            <Text style={s.primaryText}>Spremi</Text>
          </Pressable>
        </Sheet>

        {/* RENAME FOLDER */}
        <Sheet visible={renameOpen} title="Preimenuj mapu" onClose={() => setRenameOpen(false)}>
          <TextInput value={renameName} onChangeText={setRenameName} placeholder="Naziv mape" style={s.search} />
          <Pressable
            style={[s.primary, renameFolderM.isPending && { opacity: 0.6 }]}
            disabled={renameFolderM.isPending}
            onPress={async () => {
              if (!renameId) return;
              const name = renameName.trim();
              if (!name) return;
              await renameFolderM.mutateAsync({ id: renameId, payload: { name } });
              setRenameOpen(false);
              foldersQ.refetch();
            }}
          >
            <Text style={s.primaryText}>Spremi</Text>
          </Pressable>
        </Sheet>

        {/* DELETE FOLDER CONFIRM */}
        <ConfirmSheet
          visible={deleteOpen}
          title="Obrisati mapu?"
          description={deleteLabel}
          confirmText="Obriši"
          danger
          onClose={() => setDeleteOpen(false)}
          onConfirm={async () => {
            if (!deleteId) return;
            await deleteFolderM.mutateAsync(deleteId);
            setDeleteOpen(false);
            foldersQ.refetch();
          }}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  // ✅ FIX: layout da se "Dodaj" uvijek vidi
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  segmentWrap: {
    flex: 1,
    minWidth: 0,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexShrink: 0,
  },
  addText: { color: "#fff", fontWeight: "900" },

  search: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  helper: { color: Colors.sub, fontWeight: "700" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "900", color: Colors.text },
  badge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.sharedBg,
    color: Colors.sharedText,
  },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },
  empty: { textAlign: "center", color: Colors.sub, marginTop: 20, fontWeight: "800" },

  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  actionText: { fontWeight: "900", color: Colors.text },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
