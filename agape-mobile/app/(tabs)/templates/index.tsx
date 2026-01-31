import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Animated, { interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import {
  canEditDeleteTemplate,
  useCreateFolder,
  useDeleteFolder,
  useDeleteTemplate,
  useRenameFolder,
  useTemplateFolders,
  useTemplateList,
} from "@/app/api/hooks/useDispatchTemplates";
import TemplatesHeader from "./TemplatesHeader";

type Mode = "SVE" | "MOJI" | "DIJELJENI";

type Entry =
  | { kind: "FOLDER"; id: number; name: string }
  | {
      kind: "TPL";
      id: number;
      name: string;
      description?: string | null;
      householdSize?: number | null;
      shared?: boolean;
      sharedPermission?: "VIEW" | "BOOK" | null;
    };

function accent(mode: Mode) {
  if (mode === "SVE") return { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.28)", text: "#2563EB" };
  if (mode === "DIJELJENI") return { bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.26)", text: "#7C3AED" };
  return { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.28)", text: Colors.orange };
}

function RightActionButton({
  label,
  icon,
  danger,
  onPress,
  progress,
  index,
}: {
  label: string;
  icon: any;
  danger?: boolean;
  onPress: () => void;
  progress: SharedValue<number>;
  index: number;
}) {
  const rStyle = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [0, 1], [40 * (index + 1), 0]);
    const o = interpolate(progress.value, [0, 1], [0, 1]);
    return { transform: [{ translateX: t }], opacity: o };
  });

  return (
    <Animated.View style={[sw.actionWrap, rStyle]}>
      <Pressable onPress={onPress} style={[sw.actionBtn, danger ? sw.delete : sw.edit]}>
        <FontAwesome name={icon} size={16} color={danger ? Colors.dangerText : Colors.text} />
        <Text style={[sw.actionText, danger ? { color: Colors.dangerText } : null]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function TemplatesRoot() {
  const [mode, setMode] = useState<Mode>("SVE");
  const [q, setQ] = useState("");

  const foldersQ = useTemplateFolders();
  const allFolders = foldersQ.data ?? [];

  // root folderi = parentId null
  const rootFolders = useMemo(() => allFolders.filter((f: any) => f.parentId == null), [allFolders]);

  const includeShared = mode !== "MOJI";
  const templatesQ = useTemplateList({ folderId: null, q, includeShared, rootOnly: true });
  const templates = templatesQ.data ?? [];

  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();
  const deleteTplM = useDeleteTemplate();

  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ✅ refreshing samo kad user povuče
  const [refreshing, setRefreshing] = useState(false);

  const a = accent(mode);

  const entries: Entry[] = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const folderEntries: Entry[] =
      mode === "DIJELJENI"
        ? []
        : rootFolders
            .filter((f: any) => !qq || String(f.name ?? "").toLowerCase().includes(qq))
            .map((f: any) => ({ kind: "FOLDER", id: f.id, name: f.name }));

    const tplEntries: Entry[] = templates.map((t: any) => ({
      kind: "TPL",
      id: t.id,
      name: t.name,
      description: t.description,
      householdSize: t.householdSize,
      shared: !!t.shared,
      sharedPermission: t.sharedPermission ?? null,
    }));

    return [...folderEntries, ...tplEntries].sort((x, y) => x.name.localeCompare(y.name, "hr", { sensitivity: "base" }));
  }, [rootFolders, templates, q, mode]);

  // modali/sheets
  const [addOpen, setAddOpen] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<number | null>(null);
  const [deleteFolderLabel, setDeleteFolderLabel] = useState("");

  const [deleteTplOpen, setDeleteTplOpen] = useState(false);
  const [deleteTplId, setDeleteTplId] = useState<number | null>(null);
  const [deleteTplLabel, setDeleteTplLabel] = useState("");

  const openFolder = (folderId: number, folderName: string) => {
    router.push({
      pathname: "/(tabs)/templates/folder/[folderId]",
      params: { folderId: String(folderId), folderName, mode },
    });
  };

  const onRefresh = async () => {
    try {
      setErrMsg(null);
      setRefreshing(true);
      await Promise.all([foldersQ.refetch(), templatesQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderRightActions = (item: Entry, progress: SharedValue<number>, close: () => void) => {
    if (item.kind === "FOLDER") {
      return (
        <View style={sw.actions}>
          <RightActionButton
            label="Preimenuj"
            icon="pencil"
            progress={progress}
            index={0}
            onPress={() => {
              close();
              setRenameId(item.id);
              setRenameName(item.name);
              setRenameOpen(true);
            }}
          />
          <RightActionButton
            label="Obriši"
            icon="trash"
            danger
            progress={progress}
            index={1}
            onPress={() => {
              close();
              setDeleteFolderId(item.id);
              setDeleteFolderLabel(item.name);
              setDeleteFolderOpen(true);
            }}
          />
        </View>
      );
    }

    const can = canEditDeleteTemplate({ shared: item.shared, sharedPermission: item.sharedPermission });
    if (!can) return <View style={sw.actions} />;

    return (
      <View style={sw.actions}>
        <RightActionButton
          label="Uredi"
          icon="pencil"
          progress={progress}
          index={0}
          onPress={() => {
            close();
            router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id), edit: "1" } });
          }}
        />
        <RightActionButton
          label="Obriši"
          icon="trash"
          danger
          progress={progress}
          index={1}
          onPress={() => {
            close();
            setDeleteTplId(item.id);
            setDeleteTplLabel(item.name);
            setDeleteTplOpen(true);
          }}
        />
      </View>
    );
  };

  const errText = (foldersQ.error as any)?.message || (templatesQ.error as any)?.message || null;

  return (
    <Screen>
      <View style={s.container}>
        {!!errMsg && <Banner type="error" text={errMsg} />}
        {!!errText && <Banner type="error" text={String(errText)} />}

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

        <TextInput value={q} onChangeText={setQ} placeholder="Pretraži…" placeholderTextColor={Colors.sub} style={s.search} />

        <FlatList
          data={entries}
          keyExtractor={(x) => `${x.kind}-${x.id}`}
          // ✅ više ne koristimo isFetching kao refreshing → nema "polu spinnera"
          refreshing={refreshing}
          onRefresh={onRefresh}
          removeClippedSubviews={false} // ✅ bitno za iOS + swipeable
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => {
            const onPress = () => {
              if (item.kind === "FOLDER") return openFolder(item.id, item.name);
              router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id) } });
            };

            const isFolder = item.kind === "FOLDER";
            const card = isFolder ? (
              <View style={[s.folderCard, { backgroundColor: a.bg, borderColor: a.border }]}>
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
              </View>
            ) : (
              <View style={[s.card, item.shared ? { backgroundColor: Colors.sharedBg, borderColor: Colors.sharedBorder } : null]}>
                <View style={s.row}>
                  <View style={[s.iconCircle, item.shared ? { backgroundColor: "rgba(59,130,246,0.12)" } : null]}>
                    <FontAwesome name={item.shared ? "share-alt" : "file-text-o"} size={16} color={item.shared ? Colors.sharedText : Colors.text} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={s.title}>{item.name}</Text>
                      {item.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}
                      {item.shared && item.sharedPermission ? (
                        <Text
                          style={[
                            s.badge,
                            item.sharedPermission === "BOOK"
                              ? { backgroundColor: "rgba(34,197,94,0.18)", color: "#16A34A" }
                              : { backgroundColor: "rgba(148,163,184,0.25)", color: Colors.text },
                          ]}
                        >
                          {item.sharedPermission}
                        </Text>
                      ) : null}
                    </View>

                    {typeof item.householdSize === "number" ? <Text style={s.sub}>Kućanstvo: {item.householdSize}</Text> : null}
                    {!!item.description ? (
                      <Text style={s.desc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>

                  <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                </View>
              </View>
            );

            return (
              <View style={{ borderRadius: 18, overflow: "hidden" }}>
                <ReanimatedSwipeable
                  overshootRight={false}
                  friction={2}
                  rightThreshold={40}
                  renderRightActions={(progress, _dragX, swipeable) => renderRightActions(item, progress, () => swipeable.close())}
                >
                  <Pressable onPress={onPress}>{card}</Pressable>
                </ReanimatedSwipeable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>{foldersQ.isLoading || templatesQ.isLoading ? "Učitavam…" : "Nema podataka."}</Text>}
        />

        {/* DODAJ */}
        <CenterSheet visible={addOpen} title="Dodaj" onClose={() => setAddOpen(false)}>
          <View style={{ gap: 12 }}>
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

            <Pressable
              style={s.addItem}
              onPress={() => {
                setAddOpen(false);
                router.push({ pathname: "/(tabs)/templates/template/novi", params: { folderId: "null" } });
              }}
            >
              <FontAwesome name="file-text-o" size={16} color={Colors.text} />
              <Text style={s.addItemText}>Novi predložak</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* NOVA MAPA */}
        <CenterSheet visible={newFolderOpen} title="Nova mapa" onClose={() => setNewFolderOpen(false)}>
          <View style={{ gap: 12 }}>
            <TextInput value={newFolderName} onChangeText={setNewFolderName} placeholder="Naziv mape" placeholderTextColor={Colors.sub} style={s.search} />
            <Pressable
              style={[s.primary, createFolderM.isPending && { opacity: 0.7 }]}
              disabled={createFolderM.isPending}
              onPress={async () => {
                try {
                  const name = newFolderName.trim();
                  if (!name) return;
                  setErrMsg(null);
                  await createFolderM.mutateAsync({ name, parentId: null });
                  setNewFolderName("");
                  setNewFolderOpen(false);
                } catch (e: any) {
                  setErrMsg(e?.message ?? "Greška pri kreiranju mape.");
                }
              }}
            >
              <Text style={s.primaryText}>{createFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* PREIMENUJ */}
        <CenterSheet visible={renameOpen} title="Preimenuj mapu" onClose={() => setRenameOpen(false)}>
          <View style={{ gap: 12 }}>
            <TextInput value={renameName} onChangeText={setRenameName} placeholder="Naziv mape" placeholderTextColor={Colors.sub} style={s.search} />
            <Pressable
              style={[s.primary, renameFolderM.isPending && { opacity: 0.7 }]}
              disabled={renameFolderM.isPending}
              onPress={async () => {
                try {
                  if (!renameId) return;
                  const name = renameName.trim();
                  if (!name) return;
                  setErrMsg(null);
                  await renameFolderM.mutateAsync({ id: renameId, payload: { name } });
                  setRenameOpen(false);
                } catch (e: any) {
                  setErrMsg(e?.message ?? "Greška pri preimenovanju.");
                }
              }}
            >
              <Text style={s.primaryText}>{renameFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* OBRIŠI MAPU */}
        <CenterConfirmSheet
          visible={deleteFolderOpen}
          title="Obrisati mapu?"
          description={deleteFolderLabel}
          confirmText="Obriši"
          danger
          loading={deleteFolderM.isPending}
          onClose={() => setDeleteFolderOpen(false)}
          onConfirm={async () => {
            try {
              if (!deleteFolderId) return;
              setErrMsg(null);
              await deleteFolderM.mutateAsync(deleteFolderId);
              setDeleteFolderOpen(false);
            } catch (e: any) {
              setErrMsg(e?.message ?? "Greška pri brisanju mape.");
            }
          }}
        />

        {/* OBRIŠI TEMPLATE */}
        <CenterConfirmSheet
          visible={deleteTplOpen}
          title="Obrisati predložak?"
          description={deleteTplLabel}
          confirmText="Obriši"
          danger
          loading={deleteTplM.isPending}
          onClose={() => setDeleteTplOpen(false)}
          onConfirm={async () => {
            try {
              if (!deleteTplId) return;
              setErrMsg(null);
              await deleteTplM.mutateAsync(deleteTplId);
              setDeleteTplOpen(false);
            } catch (e: any) {
              setErrMsg(e?.message ?? "Greška pri brisanju predloška.");
            }
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

  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.orange, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexShrink: 0 },
  addText: { color: "#fff", fontWeight: "900" },

  search: { backgroundColor: Colors.bg, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "800", color: Colors.text },

  listContent: { gap: 10, paddingBottom: 24 },

  folderCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  card: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14 },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center", justifyContent: "center" },

  title: { fontSize: 15, fontWeight: "900", color: Colors.text },
  badge: { fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.sharedBg, color: Colors.sharedText },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "700" },
  desc: { marginTop: 4, color: "#475569", fontWeight: "600" },

  empty: { textAlign: "center", color: Colors.sub, marginTop: 20, fontWeight: "800" },

  addItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "rgba(148,163,184,0.18)" },
  addItemText: { fontWeight: "900", color: Colors.text },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
});

const sw = StyleSheet.create({
  actions: { height: "100%", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingRight: 6 },
  actionWrap: { height: "100%", justifyContent: "center" },
  actionBtn: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, minWidth: 92, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  edit: { backgroundColor: "rgba(148,163,184,0.20)" },
  delete: { backgroundColor: Colors.dangerBg },
  actionText: { fontWeight: "900", color: Colors.text },
});
