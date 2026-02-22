import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Animated, { interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { Segmented } from "@/components/Segmented";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { toUserMessage } from "@/app/api/apiClient";
import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";


import { styles as s, swipeStyles as sw } from "./styles/TemplatesRoot.styles";
import { useTemplateFolders, useTemplateList, useCreateFolder, useRenameFolder, useDeleteFolder, useDeleteTemplate, canEditDeleteTemplate } from "@/app/api/hooks/templates/useDispatchTemplates";

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

function getModeAccent(mode: Mode) {
  if (mode === "SVE") {
    return { bg: Colors.sharedBg, border: Colors.sharedBorder, text: Colors.sharedText };
  }
  if (mode === "DIJELJENI") {
    return { bg: Colors.neutralBgSoft, border: Colors.border, text: Colors.text };
  }
  return { bg: Colors.status.warnBg, border: Colors.status.warnBd, text: Colors.orange };
}

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
        <Text style={[sw.actionText, danger ? sw.actionTextDanger : null]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function TemplatesRoot() {
  const tabBarHeight = useBottomTabBarHeight();

  const [mode, setMode] = useState<Mode>("SVE");
  const [q, setQ] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const showFolders = mode === "SVE";

  const foldersQ = useTemplateFolders({ parentId: null, size: 20, enabled: showFolders });
  const allFolders = foldersQ.data ?? [];
  const rootFolders = useMemo(
    () => (showFolders ? allFolders.filter((f: any) => f.parentId == null) : []),
    [allFolders, showFolders]
  );

  const templateScope = useMemo<"ALL" | "OWNED" | "SHARED">(() => {
    if (mode === "MOJI") return "OWNED";
    if (mode === "DIJELJENI") return "SHARED";
    return "ALL";
  }, [mode]);

  const templatesQ = useTemplateList({
    folderId: null,
    q,
    scope: templateScope,
    rootOnly: showFolders,
    size: 20,
  });

  const templates = templatesQ.data ?? [];

  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();
  const deleteTplM = useDeleteTemplate();

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      if (showFolders) foldersQ.clearStatus?.();
      templatesQ.clearStatus?.();

      await Promise.allSettled([
        showFolders ? Promise.resolve(foldersQ.refresh?.()) : Promise.resolve(),
        Promise.resolve(templatesQ.refetch()),
      ]);
    },
  ]);

  const onRefreshSafe = useCallback(async () => {
    setErrMsg(null);
    await onRefresh();
  }, [onRefresh]);

  const accent = useMemo(() => getModeAccent(mode), [mode]);

  const listContentStyle = useMemo(
    () => [s.listContent, { paddingBottom: tabBarHeight + 20 }],
    [tabBarHeight]
  );

  const entries: Entry[] = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const folderEntries: Entry[] = !showFolders
      ? []
      : rootFolders
        .filter((f: any) => !qq || String(f.name ?? "").toLowerCase().includes(qq))
        .map((f: any) => ({ kind: "FOLDER", id: f.id, name: f.name }));

    const tplEntries: Entry[] = (templates ?? []).map((t: any) => ({
      kind: "TPL",
      id: t.id,
      name: t.name,
      description: t.description,
      householdSize: t.householdSize,
      shared: !!t.shared,
      sharedPermission: t.sharedPermission ?? null,
    }));

    return [...folderEntries, ...tplEntries].sort((x, y) =>
      x.name.localeCompare(y.name, "hr", { sensitivity: "base" })
    );
  }, [showFolders, rootFolders, templates, q]);

  const foldersQueryErrorMessage = useMemo(() => {
    if (!showFolders) return null;
    if (!foldersQ.error) return null;
    if ((allFolders?.length ?? 0) > 0) return null;
    return toUserMessage(foldersQ.error, "Greška prilikom učitavanja mapa.");
  }, [showFolders, foldersQ.error, allFolders?.length]);

  const templatesQueryErrorMessage = useMemo(() => {
    if (!templatesQ.error) return null;
    if ((templates?.length ?? 0) > 0) return null;
    return toUserMessage(templatesQ.error, "Greška prilikom učitavanja predložaka.");
  }, [templatesQ.error, templates?.length]);

  const topError = errMsg || foldersQueryErrorMessage || templatesQueryErrorMessage || null;

  const onTopErrorAction = useCallback(async () => {
    if (showFolders) foldersQ.clearStatus?.();
    templatesQ.clearStatus?.();
    await onRefreshSafe();
  }, [showFolders, foldersQ, templatesQ, onRefreshSafe]);

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

  const [moreOpen, setMoreOpen] = useState(false);
  const [moreItem, setMoreItem] = useState<Entry | null>(null);

  const openFolder = (folderId: number, folderName: string) => {
    router.push({
      pathname: "/(tabs)/templates/folder/[folderId]",
      params: { folderId: String(folderId), folderName, mode },
    });
  };

  const openMore = (item: Entry) => {
    setMoreItem(item);
    setMoreOpen(true);
  };

  const renderRightActions = (item: Entry, progress: SharedValue<number>, close: () => void) => {
    const canDeleteTpl =
      item.kind === "TPL" &&
      canEditDeleteTemplate({
        shared: item.shared,
        sharedPermission: item.sharedPermission,
      });

    const canDeleteFolder = item.kind === "FOLDER";

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

  const isInitialLoading = (((showFolders && foldersQ.isLoading) || templatesQ.isLoading) && !refreshing);

  const anyLoadingMore = (showFolders && foldersQ.loadingMore) || templatesQ.loadingMore;
  const nextLoadMoreError = (showFolders ? foldersQ.loadMoreError : null) || templatesQ.loadMoreError || null;

  const showFooterLoadMore = !!anyLoadingMore;
  const showFooterLoadMoreError = !!nextLoadMoreError;

  return (
    <Screen>
      <View style={s.container}>
        {!!topError && (
          <View style={s.topErrorWrap}>
            <ErrorCard
              title="Greška"
              message={topError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              titleLines={1}
              messageLines={2}
            />
          </View>
        )}

        <View style={s.topRow}>
          <View style={s.segmentWrap}>
            <Segmented<Mode>
              value={mode}
              options={[
                { value: "SVE", label: "Sve" },
                { value: "MOJI", label: "Moji" },
                { value: "DIJELJENI", label: "Dijeljeni" },
              ]}
              onChange={(next) => {
                setErrMsg(null);
                setMode(next);
              }}
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
            onPress={() => setAddOpen(true)}
            hitSlop={10}
          >
            <FontAwesome name="plus" size={14} color={Colors.onPrimaryText} />
            <Text style={s.addText}>Dodaj</Text>
          </Pressable>
        </View>

        <TextInput
          value={q}
          onChangeText={(v) => {
            setErrMsg(null);
            setQ(v);
          }}
          placeholder="Pretraži…"
          placeholderTextColor={Colors.sub}
          style={s.search}
        />

        <FlatList
          style={s.list}
          data={entries}
          keyExtractor={(x) => `${x.kind}-${x.id}`}
          refreshing={refreshing}
          onRefresh={onRefreshSafe}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={listContentStyle}
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            if (refreshing || foldersQ.loading || foldersQ.loadingMore || templatesQ.loading || templatesQ.loadingMore) {
              return;
            }

            if (showFolders && foldersQ.canLoadMore) {
              foldersQ.loadMore?.();
              return;
            }

            if (templatesQ.canLoadMore) {
              templatesQ.loadMore?.();
            }
          }}
          renderItem={({ item }) => {
            const onPress = () => {
              if (item.kind === "FOLDER") {
                openFolder(item.id, item.name);
                return;
              }

              router.push({
                pathname: "/(tabs)/templates/template/[id]",
                params: { id: String(item.id) },
              });
            };

            const isFolder = item.kind === "FOLDER";

            const card = isFolder ? (
              <View style={[s.folderCard, { backgroundColor: accent.bg, borderColor: accent.border }]}>
                <View style={s.row}>
                  <View style={[s.iconCircle, s.folderIconCircle]}>
                    <FontAwesome name="folder" size={16} color={accent.text} />
                  </View>

                  <View style={s.rowContent}>
                    <Text style={s.title}>{item.name}</Text>
                    <Text style={s.sub}>Otvori mapu</Text>
                  </View>

                  <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                </View>
              </View>
            ) : (
              <View style={[s.card, item.shared ? s.cardShared : null]}>
                <View style={s.row}>
                  <View style={[s.iconCircle, item.shared ? s.iconCircleShared : null]}>
                    <FontAwesome
                      name={item.shared ? "share-alt" : "file-text-o"}
                      size={16}
                      color={item.shared ? Colors.sharedText : Colors.text}
                    />
                  </View>

                  <View style={s.rowContent}>
                    <View style={s.titleRow}>
                      <Text style={s.title}>{item.name}</Text>

                      {item.shared ? <Text style={s.badge}>DIJELJENO</Text> : null}

                      {item.shared && item.sharedPermission ? (
                        <Text style={[s.badge, item.sharedPermission === "BOOK" ? s.badgeBook : s.badgeView]}>
                          {item.sharedPermission}
                        </Text>
                      ) : null}
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
              </View>
            );

            return (
              <View style={s.swipeWrap}>
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
          ListEmptyComponent={<Text style={s.empty}>{isInitialLoading ? "Učitavam…" : "Nema podataka."}</Text>}
          ListFooterComponent={
            showFooterLoadMore || showFooterLoadMoreError ? (
              <View style={{ paddingVertical: 12, alignItems: "center", gap: 8 }}>
                {showFooterLoadMore ? <ActivityIndicator size="small" /> : null}

                {showFooterLoadMoreError ? (
                  <Pressable
                    onPress={() => {
                      if (showFolders && foldersQ.canLoadMore) {
                        foldersQ.loadMore?.();
                        return;
                      }
                      templatesQ.loadMore?.();
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      backgroundColor: Colors.bg,
                    }}
                  >
                    <Text style={{ color: Colors.text }}>
                      {String(nextLoadMoreError)} • Dodirni za pokušaj ponovno
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
        />

        {/* VIŠE */}
        <CenterSheet
          visible={moreOpen}
          title={moreItem?.kind === "FOLDER" ? "Mapa" : "Predložak"}
          onClose={() => setMoreOpen(false)}
        >
          <View style={s.sheetGap}>
            {!!moreItem && (
              <View style={s.moreHeader}>
                <Text style={s.moreTitle} numberOfLines={2}>
                  {moreItem.name}
                </Text>
                <Text style={s.moreSub}>Odaberi radnju</Text>
              </View>
            )}

            {moreItem?.kind === "FOLDER" && (
              <>
                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    setMoreOpen(false);
                    router.push({
                      pathname: "/(tabs)/templates/folder/premjesti",
                      params: { folderId: String(moreItem.id) },
                    });
                  }}
                >
                  <FontAwesome name="arrow-right" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Premjesti</Text>
                </Pressable>

                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    setMoreOpen(false);
                    router.push({
                      pathname: "/(tabs)/templates/folder/kopiraj",
                      params: { folderId: String(moreItem.id) },
                    });
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
                  style={[s.moreItem, s.moreItemDanger]}
                  onPress={() => {
                    setMoreOpen(false);
                    setDeleteFolderId(moreItem.id);
                    setDeleteFolderLabel(moreItem.name);
                    setDeleteFolderOpen(true);
                  }}
                >
                  <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                  <Text style={[s.moreItemText, s.moreItemTextDanger]}>Obriši</Text>
                </Pressable>
              </>
            )}

            {moreItem?.kind === "TPL" && (
              <>
                {!moreItem.shared && (
                  <Pressable
                    style={s.moreItem}
                    onPress={() => {
                      setMoreOpen(false);
                      router.push({
                        pathname: "/(tabs)/templates/template/[id]/premjesti",
                        params: { id: String(moreItem.id) },
                      });
                    }}
                  >
                    <FontAwesome name="arrow-right" size={16} color={Colors.text} />
                    <Text style={s.moreItemText}>Premjesti</Text>
                  </Pressable>
                )}

                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    setMoreOpen(false);
                    router.push({
                      pathname: "/(tabs)/templates/template/[id]/kopiraj",
                      params: { id: String(moreItem.id) },
                    });
                  }}
                >
                  <FontAwesome name="copy" size={16} color={Colors.text} />
                  <Text style={s.moreItemText}>Kopiraj</Text>
                </Pressable>

                {canEditDeleteTemplate({ shared: moreItem.shared, sharedPermission: moreItem.sharedPermission }) && (
                  <>
                    <Pressable
                      style={s.moreItem}
                      onPress={() => {
                        setMoreOpen(false);
                        router.push({
                          pathname: "/(tabs)/templates/template/[id]/edit",
                          params: { id: String(moreItem.id), edit: "1" },
                        });
                      }}
                    >
                      <FontAwesome name="pencil" size={16} color={Colors.text} />
                      <Text style={s.moreItemText}>Uredi</Text>
                    </Pressable>

                    <Pressable
                      style={[s.moreItem, s.moreItemDanger]}
                      onPress={() => {
                        setMoreOpen(false);
                        setDeleteTplId(moreItem.id);
                        setDeleteTplLabel(moreItem.name);
                        setDeleteTplOpen(true);
                      }}
                    >
                      <FontAwesome name="trash" size={16} color={Colors.dangerText} />
                      <Text style={[s.moreItemText, s.moreItemTextDanger]}>Obriši</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        </CenterSheet>

        {/* DODAJ */}
        <CenterSheet visible={addOpen} title="Dodaj" onClose={() => setAddOpen(false)}>
          <View style={s.sheetGap}>
            {showFolders && (
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
                router.push({
                  pathname: "/(tabs)/templates/template/new",
                  params: { folderId: "null" },
                });
              }}
            >
              <FontAwesome name="file-text-o" size={16} color={Colors.text} />
              <Text style={s.addItemText}>Novi predložak</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* NOVA MAPA */}
        <CenterSheet visible={newFolderOpen} title="Nova mapa" onClose={() => setNewFolderOpen(false)}>
          <View style={s.sheetGap}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
            />
            <Pressable
              style={[s.primary, createFolderM.isPending && s.disabled]}
              disabled={createFolderM.isPending}
              onPress={async () => {
                try {
                  const name = newFolderName.trim();
                  if (!name) return;

                  setErrMsg(null);
                  await createFolderM.mutateAsync({ name, parentId: null });
                  setNewFolderName("");
                  setNewFolderOpen(false);
                } catch (e) {
                  setErrMsg(toUserMessage(e, "Greška pri kreiranju mape."));
                }
              }}
            >
              <Text style={s.primaryText}>{createFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        {/* PREIMENUJ */}
        <CenterSheet visible={renameOpen} title="Preimenuj mapu" onClose={() => setRenameOpen(false)}>
          <View style={s.sheetGap}>
            <TextInput
              value={renameName}
              onChangeText={setRenameName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
            />
            <Pressable
              style={[s.primary, renameFolderM.isPending && s.disabled]}
              disabled={renameFolderM.isPending}
              onPress={async () => {
                try {
                  if (!renameId) return;
                  const name = renameName.trim();
                  if (!name) return;

                  setErrMsg(null);
                  await renameFolderM.mutateAsync({ id: renameId, payload: { name } });
                  setRenameOpen(false);
                } catch (e) {
                  setErrMsg(toUserMessage(e, "Greška pri preimenovanju."));
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
            } catch (e) {
              setErrMsg(toUserMessage(e, "Greška pri brisanju mape."));
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
            } catch (e) {
              setErrMsg(toUserMessage(e, "Greška pri brisanju predloška."));
            }
          }}
        />
      </View>
    </Screen>
  );
}