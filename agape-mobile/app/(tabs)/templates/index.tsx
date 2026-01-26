import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { useCreateFolder, useDeleteFolder, useRenameFolder, useTemplateFolders, useTemplateList } from "@/app/api/hooks/useDispatchTemplates";

type Mode = "SVE" | "MOJI" | "DIJELJENI";

type Entry =
  | { kind: "FOLDER"; id: number; name: string }
  | { kind: "TPL"; id: number; name: string; description?: string | null; householdSize?: number | null; shared?: boolean };

function accent(mode: Mode) {
  if (mode === "SVE") return { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.28)", text: "#2563EB" };
  if (mode === "DIJELJENI") return { bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.26)", text: "#7C3AED" };
  return { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.28)", text: Colors.orange };
}

export default function TemplatesRoot() {
  const [mode, setMode] = useState<Mode>("SVE");
  const [q, setQ] = useState("");

  // folderi (pretpostavka: samo moji folderi postoje)
  const foldersQ = useTemplateFolders();
  const folders = foldersQ.data ?? [];

  // templates za root ekran:
  // - MOJI: includeShared=false, rootOnly=true (samo predlošci bez mape)
  // - SVE: includeShared=true, rootOnly=true (u rootu prikaži samo root predloške + folderi; u folderu vidiš mapirane)
  // - DIJELJENI: includeShared=true, rootOnly=true (root shared)
  //
  // Ovo je UX koji si tražio: u rootu su mape + predlošci bez mape.
  const includeShared = mode !== "MOJI";
  const templatesQ = useTemplateList({
    folderId: null,
    q,
    includeShared,
    rootOnly: true,
  });
  const templates = templatesQ.data ?? [];

  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();

  const errText = (foldersQ.error as any)?.message || (templatesQ.error as any)?.message || null;
  const a = accent(mode);

  const entries: Entry[] = useMemo(() => {
    const qq = q.trim().toLowerCase();

    // folderi se prikazuju u SVE i MOJI (u DIJELJENI sakrijemo jer su “moji folderi”)
    const folderEntries: Entry[] =
      mode === "DIJELJENI"
        ? []
        : folders
          .filter((f: any) => !qq || (f.name ?? "").toLowerCase().includes(qq))
          .map((f: any) => ({ kind: "FOLDER", id: f.id, name: f.name }));

    const tplEntries: Entry[] = templates.map((t: any) => ({
      kind: "TPL",
      id: t.id,
      name: t.name,
      description: t.description,
      householdSize: t.householdSize,
      shared: !!t.shared,
    }));

    // zajedno + sortirano
    return [...folderEntries, ...tplEntries].sort((x, y) => x.name.localeCompare(y.name, "hr", { sensitivity: "base" }));
  }, [folders, templates, q, mode]);

  // modali
  const [addOpen, setAddOpen] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLabel, setDeleteLabel] = useState("");

  const openFolder = (folderId: number, folderName: string) => {
    router.push({
      pathname: "/(tabs)/templates/folder/[folderId]",
      params: { folderId: String(folderId), folderName, mode },
    });
  };

  return (
    <Screen>
      <View style={s.container}>
        {!!errText && <Banner type="error" text={errText} />}

        <View style={s.topRow}>
          <View style={s.segmentWrap}>
            <Segmented<Mode>
              value={mode}
              options={[
                { value: "SVE", label: "Sve" },
                { value: "MOJI", label: "Moji" },
                { value: "DIJELJENI", label: "Dijeljeni" },
              ]}
              onChange={setMode}
            />
          </View>

          <Pressable style={s.addBtn} onPress={() => setAddOpen(true)} hitSlop={10}>
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={s.addText}>Dodaj</Text>
          </Pressable>
        </View>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pretraži…"
          placeholderTextColor={Colors.sub}
          style={s.search}
        />

        <FlatList
          data={entries}
          keyExtractor={(x) => `${x.kind}-${x.id}`}
          refreshing={foldersQ.isFetching || templatesQ.isFetching}
          onRefresh={() => {
            foldersQ.refetch();
            templatesQ.refetch();
          }}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => {
            if (item.kind === "FOLDER") {
              return (
                <Pressable
                  style={[s.folderCard, { backgroundColor: a.bg, borderColor: a.border }]}
                  onPress={() => openFolder(item.id, item.name)}
                  onLongPress={() => {
                    setRenameId(item.id);
                    setRenameName(item.name);
                    setRenameOpen(true);
                  }}
                >
                  <View style={s.row}>
                    <View style={[s.iconCircle, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
                      <FontAwesome name="folder" size={16} color={a.text} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={s.title}>{item.name}</Text>
                      <Text style={s.sub}>Otvori mapu</Text>
                    </View>

                    <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                  </View>
                </Pressable>
              );
            }

            return (
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

                    {typeof item.householdSize === "number" ? (
                      <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text>
                    ) : null}

                    {!!item.description ? (
                      <Text style={s.desc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>

                  <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={s.empty}>
              {foldersQ.isLoading || templatesQ.isLoading ? "Učitavam…" : "Nema podataka."}
            </Text>
          }
        />

        {/* DODAJ */}
        <CenterSheet visible={addOpen} title="Dodaj" onClose={() => setAddOpen(false)}>
          <View style={{ gap: 12 }}>
            {/* Folder možeš dodati u SVE i MOJI; u DIJELJENI ga možeš sakriti ako želiš */}
            {(
              <Pressable
                style={s.addItem}
                onPress={() => {
                  setAddOpen(false);
                  setNewFolderOpen(true);
                }}
              >
                <FontAwesome name="folder" size={16} color={Colors.text} />
                <Text style={s.addItemText}>Nova mapa</Text>
              </Pressable>
            )}

            <Pressable
              style={s.addItem}
              onPress={() => {
                setAddOpen(false);
                router.push({ pathname: "/(tabs)/templates/novi", params: { folderId: "null" } }); // root template
              }}
            >
              <FontAwesome name="file-text-o" size={16} color={Colors.text} />
              <Text style={s.addItemText}>Novi predložak</Text>
            </Pressable>

            {mode !== "DIJELJENI" && folders.length > 0 ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <Text style={{ fontWeight: "900", color: Colors.text }}>Brisanje mape</Text>
                {folders.map((f: any) => (
                  <Pressable
                    key={f.id}
                    style={[s.addItem, { backgroundColor: Colors.dangerBg }]}
                    onPress={() => {
                      setAddOpen(false);
                      setDeleteId(f.id);
                      setDeleteLabel(f.name);
                      setDeleteOpen(true);
                    }}
                  >
                    <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                    <Text style={[s.addItemText, { color: Colors.dangerText }]}>Obriši mapu: {f.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </CenterSheet>

        {/* NOVA MAPA */}
        <CenterSheet visible={newFolderOpen} title="Nova mapa" onClose={() => setNewFolderOpen(false)}>
          <View style={{ gap: 12 }}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
            />
            <Pressable
              style={[s.primary, createFolderM.isPending && { opacity: 0.7 }]}
              disabled={createFolderM.isPending}
              onPress={() => {
                const name = newFolderName.trim();
                if (!name) return;

                createFolderM.mutate(
                  { name },
                  {
                    onSuccess: () => {
                      setNewFolderName("");
                      setNewFolderOpen(false);
                      foldersQ.refetch();
                    },
                  }
                );
              }}
            >
              <Text style={s.primaryText}>{createFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* PREIMENUJ */}
        <CenterSheet visible={renameOpen} title="Preimenuj mapu" onClose={() => setRenameOpen(false)}>
          <View style={{ gap: 12 }}>
            <TextInput
              value={renameName}
              onChangeText={setRenameName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
            />
            <Pressable
              style={[s.primary, renameFolderM.isPending && { opacity: 0.7 }]}
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
              <Text style={s.primaryText}>{renameFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* OBRIŠI MAPU */}
        <CenterConfirmSheet
          visible={deleteOpen}
          title="Obrisati mapu?"
          description={deleteLabel}
          confirmText="Obriši"
          danger
          loading={deleteFolderM.isPending}
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

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  segmentWrap: { flex: 1, minWidth: 0 },

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

  listContent: { gap: 10, paddingBottom: 24 },

  folderCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },

  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14 },

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
  badge: { fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.sharedBg, color: Colors.sharedText },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },

  empty: { textAlign: "center", color: Colors.sub, marginTop: 20, fontWeight: "800" },

  addItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  addItemText: { fontWeight: "900", color: Colors.text },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
