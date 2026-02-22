import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, Stack, useLocalSearchParams } from "expo-router";

import Animated, { interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
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
import NavigationHeader from "../../../../components/NavigationHeader";

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

function SwipeActionButton({
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
    const t = interpolate(progress.value, [0, 1], [42 * (index + 1), 0]);
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

export default function TemplatesFolderScreen() {
  const params = useLocalSearchParams<{ folderId: string; folderName?: string; mode?: Mode }>();
  const folderId = Number(params.folderId);
  const folderName = (params.folderName as string) ?? "Mapa";
  const mode = (params.mode as Mode) ?? "SVE";

  const [q, setQ] = useState("");
  const includeShared = mode !== "MOJI";

  const templatesQ = useTemplateList({ folderId, q, includeShared, rootOnly: false });
  const templates = templatesQ.data ?? [];

  const foldersQ = useTemplateFolders();
  const allFolders = foldersQ.data ?? [];

  const childFolders = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return allFolders.filter(
      (f: any) => f.parentId === folderId && (!qq || String(f.name ?? "").toLowerCase().includes(qq))
    );
  }, [allFolders, folderId, q]);

  const entries: Entry[] = useMemo(() => {
    const folderEntries: Entry[] = childFolders.map((f: any) => ({ kind: "FOLDER", id: f.id, name: f.name }));
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
  }, [childFolders, templates]);

  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();
  const deleteTplM = useDeleteTemplate();

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // sheets
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

  // ✅ “Više” sheet (za folder i template)
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreItem, setMoreItem] = useState<Entry | null>(null);

  const openFolder = (id: number, name: string) => {
    router.push({
      pathname: "/(tabs)/templates/folder/[folderId]",
      params: { folderId: String(id), folderName: name, mode },
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

  const openMore = (item: Entry) => {
    setMoreItem(item);
    setMoreOpen(true);
  };

  const renderRightActions = (item: Entry, progress: SharedValue<number>, close: () => void) => {
    // ✅ max 2 gumba → nema overflowa
    const canDeleteTpl = item.kind === "TPL" && canEditDeleteTemplate({ shared: item.shared, sharedPermission: item.sharedPermission });

    const canDeleteFolder = item.kind === "FOLDER" && mode !== "DIJELJENI"; // u shared view ne radimo folder akcije

    return (
      <View style={sw.actions}>
        <SwipeActionButton
          label="Više"
          icon="ellipsis-h"
          progress={progress}
          index={0}
          onPress={() => {
            close();
            openMore(item);
          }}
        />

        {(canDeleteFolder || canDeleteTpl) && (
          <SwipeActionButton
            label="Obriši"
            icon="trash"
            danger
            progress={progress}
            index={1}
            onPress={() => {
              close();
              if (item.kind === "FOLDER") {
                setDeleteFolderId(item.id);
                setDeleteFolderLabel(item.name);
                setDeleteFolderOpen(true);
              } else {
                setDeleteTplId(item.id);
                setDeleteTplLabel(item.name);
                setDeleteTplOpen(true);
              }
            }}
          />
        )}
      </View>
    );
  };

  const errText = (foldersQ.error as any)?.message || (templatesQ.error as any)?.message || null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.container}>
        {!!errMsg && <Banner type="error" text={errMsg} />}
        {!!errText && <Banner type="error" text={String(errText)} />}

        <NavigationHeader
          title={folderName}
          subtitle="Podmape i predlošci"
          fallbackHref="/(tabs)/templates"
          right={
            <Pressable style={s.addBtn} onPress={() => setAddOpen(true)} hitSlop={10}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.addText}>Dodaj</Text>
            </Pressable>
          }
        />

        <TextInput value={q} onChangeText={setQ} placeholder="Pretraži…" placeholderTextColor={Colors.sub} style={s.search} />

        <FlatList
          data={entries}
          keyExtractor={(x) => `${x.kind}-${x.id}`}
          refreshing={refreshing}
          onRefresh={onRefresh}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const onPress = () => {
              if (item.kind === "FOLDER") return openFolder(item.id, item.name);
              router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(item.id) } });
            };

            const isFolder = item.kind === "FOLDER";
            const card = isFolder ? (
              <View style={s.folderCard}>
                <View style={s.row}>
                  <View style={s.iconCircle}>
                    <FontAwesome name="folder" size={16} color={Colors.text} />
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
                  renderRightActions={(progress, _dragX, swipeable) =>
                    renderRightActions(item, progress, () => swipeable.close())
                  }
                >
                  <Pressable onPress={onPress}>{card}</Pressable>
                </ReanimatedSwipeable>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={s.empty}>{foldersQ.isLoading || templatesQ.isLoading ? "Učitavam…" : "Nema podataka u mapi."}</Text>
          }
        />

        {/* ✅ “VIŠE” ACTION SHEET */}
        <CenterSheet
          visible={moreOpen}
          title={moreItem?.kind === "FOLDER" ? "Mapa" : "Predložak"}
          onClose={() => setMoreOpen(false)}
        >
          <View style={{ gap: 12 }}>
            {!!moreItem && (
              <View style={s.moreHeader}>
                <Text style={s.moreTitle} numberOfLines={2}>
                  {moreItem.name}
                </Text>
                <Text style={s.moreSub}>Odaberi radnju</Text>
              </View>
            )}

            {/* FOLDER akcije (ne u DIJELJENI) */}
            {moreItem?.kind === "FOLDER" && mode !== "DIJELJENI" && (
              <>
                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    const id = moreItem.id;
                    setMoreOpen(false);
                    router.push({ pathname: "/(tabs)/templates/folder/premjesti", params: { folderId: String(id) } });
                  }}
                >
                  <FontAwesome name="arrow-right" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Premjesti</Text>
                </Pressable>

                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    const id = moreItem.id;
                    setMoreOpen(false);
                    router.push({ pathname: "/(tabs)/templates/folder/kopiraj", params: { folderId: String(id) } });
                  }}
                >
                  <FontAwesome name="copy" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Kopiraj</Text>
                </Pressable>

                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    setMoreOpen(false);
                    setRenameId(moreItem.id);
                    setRenameName(moreItem.name);
                    setRenameOpen(true);
                  }}
                >
                  <FontAwesome name="pencil" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Preimenuj</Text>
                </Pressable>

                <Pressable
                  style={[s.moreItem, { backgroundColor: Colors.dangerBg }]}
                  onPress={() => {
                    setMoreOpen(false);
                    setDeleteFolderId(moreItem.id);
                    setDeleteFolderLabel(moreItem.name);
                    setDeleteFolderOpen(true);
                  }}
                >
                  <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                  <Text style={[s.moreItemText, { color: Colors.dangerText }]}>Obriši</Text>
                </Pressable>
              </>
            )}

            {/* TEMPLATE akcije */}
            {moreItem?.kind === "TPL" && (
              <>
                {/* Premjesti samo ako nije shared */}
                {!moreItem.shared && (
                  <Pressable
                    style={s.moreItem}
                    onPress={() => {
                      const id = moreItem.id;
                      setMoreOpen(false);
                      router.push({ pathname: "/(tabs)/templates/template/[id]/premjesti", params: { id: String(id) } });
                    }}
                  >
                    <FontAwesome name="arrow-right" size={16} color={Colors.text} />
                    <Text style={s.moreItemText}>Premjesti</Text>
                  </Pressable>
                )}

                {/* Kopiraj može i za shared */}
                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    const id = moreItem.id;
                    setMoreOpen(false);
                    router.push({ pathname: "/(tabs)/templates/template/[id]/kopiraj", params: { id: String(id) } });
                  }}
                >
                  <FontAwesome name="copy" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Kopiraj</Text>
                </Pressable>

                {/* Uredi / Obriši samo ako canEditDelete */}
                {canEditDeleteTemplate({ shared: moreItem.shared, sharedPermission: moreItem.sharedPermission }) && (
                  <>
                    <Pressable
                      style={s.moreItem}
                      onPress={() => {
                        const id = moreItem.id;
                        setMoreOpen(false);
                        router.push({ pathname: "/(tabs)/templates/template/[id]", params: { id: String(id), edit: "1" } });
                      }}
                    >
                      <FontAwesome name="pencil" size={16} color={Colors.text} />
                      <Text style={s.moreItemText}>Uredi</Text>
                    </Pressable>

                    <Pressable
                      style={[s.moreItem, { backgroundColor: Colors.dangerBg }]}
                      onPress={() => {
                        setMoreOpen(false);
                        setDeleteTplId(moreItem.id);
                        setDeleteTplLabel(moreItem.name);
                        setDeleteTplOpen(true);
                      }}
                    >
                      <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                      <Text style={[s.moreItemText, { color: Colors.dangerText }]}>Obriši</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        </CenterSheet>

        {/* ✅ DODAJ */}
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
                router.push({ pathname: "/(tabs)/templates/template/novi", params: { folderId: String(folderId) } });
              }}
            >
              <FontAwesome name="file-text-o" size={16} color={Colors.text} />
              <Text style={s.addItemText}>Novi predložak</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* NOVA PODMAPA */}
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
              onPress={async () => {
                try {
                  const name = newFolderName.trim();
                  if (!name) return;
                  setErrMsg(null);
                  await createFolderM.mutateAsync({ name, parentId: folderId });
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

  folderCard: { backgroundColor: Colors.bg, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 14 },
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

  moreHeader: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  moreTitle: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  moreSub: { color: Colors.sub, fontWeight: "800" },

  moreItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  moreItemText: { fontWeight: "900", color: Colors.text },
});

const sw = StyleSheet.create({
  actions: {
    height: "100%",
    width: 210, // ✅ fiksno → uredno na malim ekranima
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingRight: 8,
  },
  actionWrap: { height: "100%", justifyContent: "center" },
  actionBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  edit: { backgroundColor: "rgba(148,163,184,0.20)" },
  delete: { backgroundColor: Colors.dangerBg },
  actionText: { fontWeight: "900", color: Colors.text },
});
