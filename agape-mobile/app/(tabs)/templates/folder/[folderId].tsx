import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Animated, { interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import Screen from "@/components/ui/Screen";
import NavigationHeader from "../../../../components/NavigationHeader";
import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { toUserMessage } from "../../../../src/api/apiClient";
import { usePullToRefresh } from "../../../../src/api/hooks/common/usePullToRefresh";
import {
  useTemplateFolders,
  useTemplateList,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  useDeleteTemplate,
  canEditDeleteTemplate,
} from "../../../../src/api/hooks/templates/useDispatchTemplates";

import { styles as s, swipeStyles as sw } from "../../../../src/styles/TemplatesFolder.styles";

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

function parseModeParam(v: unknown): Mode {
  const raw = Array.isArray(v) ? v[0] : v;
  const x = String(raw ?? "").toUpperCase().trim();
  if (x === "MOJI" || x === "DIJELJENI") return x;
  return "SVE";
}

function readFolderIdParam(v: unknown): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function readNullableNumberParam(v: unknown): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw == null) return null;

  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;

  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readStringParam(v: unknown): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "").trim();
  return s ? s : null;
}

/**
 * Simple debounce: returns a value after delayMs without changes.
 */
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
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

export default function TemplatesFolderScreen() {
  const params = useLocalSearchParams<{
    folderId?: string;
    folderName?: string;
    mode?: string;
    parentFolderId?: string;
    parentFolderName?: string;
  }>();

  const tabBarHeight = useBottomTabBarHeight();

  const folderId = readFolderIdParam(params.folderId);
  const hasValidFolderId = Number.isFinite(folderId) && folderId > 0;

  const folderName =
    String((Array.isArray(params.folderName) ? params.folderName[0] : params.folderName) ?? "Mapa").trim() ||
    "Mapa";

  const mode = parseModeParam(params.mode);

  const parentFolderId = useMemo(() => readNullableNumberParam(params.parentFolderId), [params.parentFolderId]);
  const parentFolderName = useMemo(() => readStringParam(params.parentFolderName) ?? "Mapa", [params.parentFolderName]);

  const backHref = useMemo(() => {
    if (parentFolderId) {
      return {
        pathname: "/(tabs)/templates/folder/[folderId]" as const,
        params: {
          folderId: String(parentFolderId),
          folderName: parentFolderName,
          mode,
          parentFolderId: params.parentFolderId ?? "null",
          parentFolderName: params.parentFolderName ?? "Root",
        },
      };
    }
    return "/(tabs)/templates" as const;
  }, [parentFolderId, parentFolderName, mode, params.parentFolderId, params.parentFolderName]);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const [screenError, setScreenError] = useState<string | null>(null);

  const showFolders = mode !== "DIJELJENI";

  const templateScope = useMemo<"ALL" | "OWNED" | "SHARED">(() => {
    if (mode === "MOJI") return "OWNED";
    if (mode === "DIJELJENI") return "SHARED";
    return "ALL";
  }, [mode]);

  const foldersQ = useTemplateFolders({
    parentId: hasValidFolderId ? folderId : null,
    q: debouncedQ,
    size: 20,
    enabled: hasValidFolderId && showFolders,
  });

  const templatesQ = useTemplateList({
    folderId: hasValidFolderId ? folderId : null,
    q: debouncedQ,
    scope: templateScope,
    rootOnly: false,
    size: 20,
    enabled: hasValidFolderId,
  });

  const childFolders = foldersQ.data ?? [];
  const templates = templatesQ.data ?? [];

  const createFolderM = useCreateFolder();
  const renameFolderM = useRenameFolder();
  const deleteFolderM = useDeleteFolder();
  const deleteTplM = useDeleteTemplate();

  const resetMutationErrors = useCallback(() => {
    createFolderM.reset();
    renameFolderM.reset();
    deleteFolderM.reset();
    deleteTplM.reset();
  }, [createFolderM, renameFolderM, deleteFolderM, deleteTplM]);

  const entries: Entry[] = useMemo(() => {
    const folderEntries: Entry[] = !showFolders
      ? []
      : (childFolders ?? []).map((f: any) => ({
        kind: "FOLDER",
        id: Number(f.id),
        name: String(f.name ?? `Mapa #${f.id}`),
      }));

    const tplEntries: Entry[] = (templates ?? []).map((t: any) => ({
      kind: "TPL",
      id: Number(t.id),
      name: String(t.name ?? `Predložak #${t.id}`),
      description: t.description,
      householdSize: t.householdSize,
      shared: !!t.shared,
      sharedPermission: t.sharedPermission ?? null,
    }));

    return [...folderEntries, ...tplEntries];
  }, [showFolders, childFolders, templates]);

  const foldersQueryErrorMessage = useMemo(() => {
    if (!showFolders) return null;
    if (!foldersQ.error) return null;
    if ((childFolders?.length ?? 0) > 0) return null;
    return toUserMessage(foldersQ.error, "Greška prilikom učitavanja mapa.");
  }, [showFolders, foldersQ.error, childFolders?.length]);

  const templatesQueryErrorMessage = useMemo(() => {
    if (!templatesQ.error) return null;
    if ((templates?.length ?? 0) > 0) return null;
    return toUserMessage(templatesQ.error, "Greška prilikom učitavanja predložaka.");
  }, [templatesQ.error, templates?.length]);

  const mutationError = useMemo(() => {
    if (createFolderM.error) return toUserMessage(createFolderM.error, "Greška pri kreiranju mape.");
    if (renameFolderM.error) return toUserMessage(renameFolderM.error, "Greška pri preimenovanju.");
    if (deleteFolderM.error) return toUserMessage(deleteFolderM.error, "Greška pri brisanju mape.");
    if (deleteTplM.error) return toUserMessage(deleteTplM.error, "Greška pri brisanju predloška.");
    return null;
  }, [createFolderM.error, renameFolderM.error, deleteFolderM.error, deleteTplM.error]);

  const topError = useMemo(() => {
    if (!hasValidFolderId) return "Neispravan parametar mape.";
    return screenError || mutationError || foldersQueryErrorMessage || templatesQueryErrorMessage || null;
  }, [hasValidFolderId, screenError, mutationError, foldersQueryErrorMessage, templatesQueryErrorMessage]);

  const refreshAll = useCallback(async () => {
    setScreenError(null);
    resetMutationErrors();

    await Promise.allSettled([
      showFolders ? Promise.resolve(foldersQ.refetch()) : Promise.resolve(),
      Promise.resolve(templatesQ.refetch()),
    ]);
  }, [showFolders, foldersQ, templatesQ, resetMutationErrors]);

  const { refreshing, onRefresh } = usePullToRefresh([refreshAll]);

  const onRefreshSafe = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  const onTopErrorAction = useCallback(async () => {
    if (!hasValidFolderId) return;
    await refreshAll();
  }, [hasValidFolderId, refreshAll]);

  const loadMore = useCallback(async () => {
    if (refreshing) return;
    if (foldersQ.loading || foldersQ.loadingMore || templatesQ.loading || templatesQ.loadingMore) return;

    const tasks: Promise<unknown>[] = [];

    if (showFolders && foldersQ.canLoadMore) {
      tasks.push(Promise.resolve(foldersQ.loadMore?.()));
    }

    if (templatesQ.canLoadMore) {
      tasks.push(Promise.resolve(templatesQ.loadMore?.()));
    }

    if (!tasks.length) return;
    await Promise.allSettled(tasks);
  }, [
    refreshing,
    showFolders,
    foldersQ.loading,
    foldersQ.loadingMore,
    foldersQ.canLoadMore,
    foldersQ.loadMore,
    templatesQ.loading,
    templatesQ.loadingMore,
    templatesQ.canLoadMore,
    templatesQ.loadMore,
  ]);

  const loadMoreErrorText = useMemo(() => {
    if (foldersQ.loadMoreError && templatesQ.loadMoreError) {
      return `${foldersQ.loadMoreError} • ${templatesQ.loadMoreError}`;
    }
    return foldersQ.loadMoreError || templatesQ.loadMoreError || null;
  }, [foldersQ.loadMoreError, templatesQ.loadMoreError]);

  const showInitialLoading =
    hasValidFolderId &&
    !refreshing &&
    (((showFolders && foldersQ.isLoading) && (childFolders?.length ?? 0) === 0) ||
      (templatesQ.isLoading && (templates?.length ?? 0) === 0));
  const showInlineLoading =
    hasValidFolderId &&
    !showInitialLoading &&
    !refreshing &&
    ((showFolders && foldersQ.loading) || templatesQ.loading);

  const showEmpty =
    !showInitialLoading &&
    !topError &&
    !refreshing &&
    (entries?.length ?? 0) === 0 &&
    !foldersQ.loading &&
    !foldersQ.loadingMore &&
    !templatesQ.loading &&
    !templatesQ.loadingMore;

  const listContentStyle = useMemo(() => [s.listContent, { paddingBottom: tabBarHeight + 20 }], [tabBarHeight]);

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

  const openFolder = useCallback(
    (id: number, name: string) => {
      router.push({
        pathname: "/(tabs)/templates/folder/[folderId]",
        params: {
          folderId: String(id),
          folderName: name,
          mode,

          parentFolderId: hasValidFolderId ? String(folderId) : "null",
          parentFolderName: folderName,
        },
      });
    },
    [mode, hasValidFolderId, folderId, folderName]
  );

  const openMore = useCallback((item: Entry) => {
    setMoreItem(item);
    setMoreOpen(true);
  }, []);

  const renderRightActions = useCallback(
    (item: Entry, progress: SharedValue<number>, close: () => void) => {
      const canDeleteTpl =
        item.kind === "TPL" &&
        canEditDeleteTemplate({
          shared: item.shared,
          sharedPermission: item.sharedPermission,
        });

      const canDeleteFolder = item.kind === "FOLDER" && mode !== "DIJELJENI";

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
    },
    [mode, openMore]
  );

  const disableAdd = !hasValidFolderId || mode === "DIJELJENI";

  return (
    <Screen style={s.screen}>
      <View style={s.container}>
        <NavigationHeader
          title={folderName}
          subtitle="Podmape i predlošci"
          fallbackHref={backHref}
          right={
            <Pressable
              style={[s.addBtn, disableAdd && s.disabled]}
              disabled={disableAdd}
              onPress={() => {
                if (disableAdd) return;
                setScreenError(null);
                resetMutationErrors();
                setAddOpen(true);
              }}
              hitSlop={10}
            >
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.addText}>Dodaj</Text>
            </Pressable>
          }
        />

        {!!topError && (
          <View style={s.topErrorWrap}>
            <ErrorCard
              title="Greška"
              message={topError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              titleLines={1}
              messageLines={3}
            />
          </View>
        )}

        <View style={s.searchWrap}>
          <FontAwesome name="search" size={14} color={Colors.sub} />

          <TextInput
            value={q}
            onChangeText={(value) => {
              setScreenError(null);
              resetMutationErrors();
              setQ(value);
            }}
            placeholder="Pretraži…"
            placeholderTextColor={Colors.sub}
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {!!q && (
            <Pressable onPress={() => setQ("")} hitSlop={8} style={s.searchClearBtn}>
              <FontAwesome name="times-circle" size={16} color={Colors.sub} />
            </Pressable>
          )}
        </View>

        {showInlineLoading ? (
          <View style={s.inlineLoading}>
            <ActivityIndicator size="small" />
            <Text style={s.inlineLoadingText}>Osvježavam mapu…</Text>
          </View>
        ) : null}

        {showInitialLoading ? (
          <View style={s.centerLoading}>
            <ActivityIndicator />
            <Text style={s.loadingText}>Učitavam…</Text>
          </View>
        ) : (
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
            onEndReached={loadMore}
            renderItem={({ item }) => {
              const onPress = () => {
                if (item.kind === "FOLDER") {
                  openFolder(item.id, item.name);
                  return;
                }

                router.push({
                  pathname: "/(tabs)/templates/template/[id]",
                  params: {
                    id: String(item.id),
                    folderId: String(folderId),
                    folderName,
                    mode,
                  },
                });
              };

              const isFolder = item.kind === "FOLDER";

              const card = isFolder ? (
                <View style={s.folderCard}>
                  <View style={s.row}>
                    <View style={s.iconCircle}>
                      <FontAwesome name="folder" size={16} color={Colors.text} />
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
                          <Text
                            style={[
                              s.badge,
                              item.sharedPermission === "BOOK" ? s.badgeBook : s.badgeView,
                            ]}
                          >
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
            ListEmptyComponent={showEmpty ? <Text style={s.empty}>Nema podataka u mapi.</Text> : null}
            ListFooterComponent={
              foldersQ.loadingMore || templatesQ.loadingMore || loadMoreErrorText ? (
                <View style={s.footerLoading}>
                  {foldersQ.loadingMore || templatesQ.loadingMore ? <ActivityIndicator size="small" /> : null}

                  {!!loadMoreErrorText && (
                    <Pressable onPress={loadMore} style={s.footerRetryBtn}>
                      <Text style={s.footerRetryText}>
                        {String(loadMoreErrorText)} • Dodirni za pokušaj ponovno
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : null
            }
          />
        )}

        <CenterSheet visible={moreOpen} title={moreItem?.kind === "FOLDER" ? "Mapa" : "Predložak"} onClose={() => setMoreOpen(false)}>
          <View style={s.sheetGap}>
            {!!moreItem && (
              <View style={s.moreHeader}>
                <Text style={s.moreTitle} numberOfLines={2}>
                  {moreItem.name}
                </Text>
                <Text style={s.moreSub}>Odaberi radnju</Text>
              </View>
            )}

            {moreItem?.kind === "FOLDER" && mode !== "DIJELJENI" && (
              <>
                <Pressable
                  style={s.moreItem}
                  onPress={() => {
                    const id = moreItem.id;
                    setMoreOpen(false);
                    router.push({
                      pathname: "/(tabs)/templates/folder/move",
                      params: { folderId: String(id) },
                    });
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
                    router.push({
                      pathname: "/(tabs)/templates/folder/copy",
                      params: {
                        folderId: String(id),
                        parentFolderId: String(folderId),
                        parentFolderName: folderName,
                        mode,
                      },
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
                      const id = moreItem.id;
                      setMoreOpen(false);
                      router.push({
                        pathname: "/(tabs)/templates/folder/move",
                        params: {
                          folderId: String(id),
                          parentFolderId: String(folderId),
                          parentFolderName: folderName,
                          mode,
                        },
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
                    const id = moreItem.id;
                    setMoreOpen(false);
                    router.push({
                      pathname: "/(tabs)/templates/template/[id]/copy",
                      params: { id: String(id) },
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
                        const id = moreItem.id;
                        setMoreOpen(false);
                        router.push({
                          pathname: "/(tabs)/templates/template/[id]",
                          params: { id: String(id), edit: "1" },
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

        <CenterSheet visible={addOpen} title="Dodaj" onClose={() => setAddOpen(false)}>
          <View style={s.sheetGap}>
            {mode !== "DIJELJENI" && (
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
                  params: { folderId: String(folderId) },
                });
              }}
            >
              <FontAwesome name="file-text-o" size={16} color={Colors.text} />
              <Text style={s.addItemText}>Novi predložak</Text>
            </Pressable>
          </View>
        </CenterSheet>

        <CenterSheet visible={newFolderOpen} title="Nova mapa" onClose={() => setNewFolderOpen(false)}>
          <View style={s.sheetGap}>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
              editable={!createFolderM.isPending}
              autoCorrect={false}
            />

            <Pressable
              style={[s.primary, createFolderM.isPending && s.disabled]}
              disabled={createFolderM.isPending}
              onPress={async () => {
                const name = newFolderName.trim();
                if (!name || !hasValidFolderId) return;

                try {
                  setScreenError(null);
                  await createFolderM.mutateAsync({ name, parentId: folderId });
                  setNewFolderName("");
                  setNewFolderOpen(false);
                } catch (e) {
                  setScreenError(toUserMessage(e, "Greška pri kreiranju mape."));
                }
              }}
            >
              <Text style={s.primaryText}>{createFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        <CenterSheet visible={renameOpen} title="Preimenuj mapu" onClose={() => setRenameOpen(false)}>
          <View style={s.sheetGap}>
            <TextInput
              value={renameName}
              onChangeText={setRenameName}
              placeholder="Naziv mape"
              placeholderTextColor={Colors.sub}
              style={s.search}
              editable={!renameFolderM.isPending}
              autoCorrect={false}
            />

            <Pressable
              style={[s.primary, renameFolderM.isPending && s.disabled]}
              disabled={renameFolderM.isPending}
              onPress={async () => {
                const name = renameName.trim();
                if (!name || !renameId) return;

                try {
                  setScreenError(null);
                  await renameFolderM.mutateAsync({ id: renameId, payload: { name } });
                  setRenameOpen(false);
                } catch (e) {
                  setScreenError(toUserMessage(e, "Greška pri preimenovanju."));
                }
              }}
            >
              <Text style={s.primaryText}>{renameFolderM.isPending ? "Spremam…" : "Spremi"}</Text>
            </Pressable>
          </View>
        </CenterSheet>

        <CenterConfirmSheet
          visible={deleteFolderOpen}
          title="Obrisati mapu?"
          description={deleteFolderLabel}
          confirmText="Obriši"
          danger
          loading={deleteFolderM.isPending}
          onClose={() => setDeleteFolderOpen(false)}
          onConfirm={async () => {
            if (!deleteFolderId) return;

            try {
              setScreenError(null);
              await deleteFolderM.mutateAsync(deleteFolderId);
              setDeleteFolderOpen(false);
            } catch (e) {
              setScreenError(toUserMessage(e, "Greška pri brisanju mape."));
            }
          }}
        />

        <CenterConfirmSheet
          visible={deleteTplOpen}
          title="Obrisati predložak?"
          description={deleteTplLabel}
          confirmText="Obriši"
          danger
          loading={deleteTplM.isPending}
          onClose={() => setDeleteTplOpen(false)}
          onConfirm={async () => {
            if (!deleteTplId) return;

            try {
              setScreenError(null);
              await deleteTplM.mutateAsync(deleteTplId);
              setDeleteTplOpen(false);
            } catch (e) {
              setScreenError(toUserMessage(e, "Greška pri brisanju predloška."));
            }
          }}
        />
      </View>
    </Screen>
  );
}
