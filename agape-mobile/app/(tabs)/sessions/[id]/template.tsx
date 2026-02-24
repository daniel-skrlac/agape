import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import NavigationHeader from "@/components/NavigationHeader";
import { ErrorCard } from "@/components/ErrorCard";

import { toUserMessage } from "@/app/api/apiClient";
import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import { useTemplateFolders, useTemplateList } from "@/app/api/hooks/templates/useDispatchTemplates";
import type { FolderResponseDTO, TemplateResponseDTO } from "@/app/models/generated";
import { patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 20;
const PLACEHOLDER = "rgba(148,163,184,0.85)";
const SEARCH_DEBOUNCE_MS = 220;

type ScopeTab = "mine" | "shared";

type RowEntry =
  | { kind: "FOLDER"; id: number; name: string; raw: FolderResponseDTO }
  | { kind: "TPL"; id: number; raw: TemplateResponseDTO };

function normDocDocumentId(d: any): number {
  return Number(d?.documentId ?? d?.document_id ?? d?.document?.id ?? d?.document?.documentId ?? 0);
}

function normDocLabel(d: any): string {
  const name = String(d?.documentName ?? d?.document?.name ?? d?.name ?? "").trim();
  const code = String(d?.documentCode ?? d?.document?.code ?? d?.code ?? "").trim();
  const docId = normDocDocumentId(d);

  if (name) return name;
  if (code) return code;
  if (docId) return `Dokument #${docId}`;

  const tid = Number(d?.id ?? 0);
  return tid ? `Doc #${tid}` : "Dokument";
}

function summarizeDocTypes(tpl: any): string {
  const docs = ((tpl as any)?.documents ?? (tpl as any)?.docs ?? []) as any[];
  const labels = docs.map(normDocLabel).filter(Boolean);

  const uniq: string[] = [];
  for (const x of labels) {
    const k = String(x).trim();
    if (!k) continue;
    if (!uniq.includes(k)) uniq.push(k);
  }

  if (!uniq.length) return "—";
  if (uniq.length <= 2) return uniq.join(" • ");
  return `${uniq.slice(0, 2).join(" • ")} • +${uniq.length - 2}`;
}

export default function SessionTemplatePicker() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);

  const tabBarHeight = useBottomTabBarHeight();
  const listBottomPad = tabBarHeight + 16;

  const [tab, setTab] = useState<ScopeTab>("mine");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [folderId, setFolderId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<Array<{ id: number | null; name: string }>>([{ id: null, name: "Root" }]);

  const showFolders = tab === "mine";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const foldersQ = useTemplateFolders({
    parentId: folderId,
    size: PAGE_SIZE,
    enabled: showFolders,
  });

  const templatesQ = useTemplateList({
    folderId: tab === "mine" ? folderId : null,
    q: debouncedQ,
    scope: tab === "mine" ? "OWNED" : "SHARED",
    rootOnly: tab === "mine" && folderId == null,
    size: PAGE_SIZE,
    enabled: true,
  });

  const folderRows = useMemo(() => {
    const qq = debouncedQ.toLowerCase();
    const src = (foldersQ.data ?? []) as FolderResponseDTO[];
    if (!qq) return src;

    return src.filter((f: any) => String((f as any)?.name ?? "").toLowerCase().includes(qq));
  }, [foldersQ.data, debouncedQ]);

  const templateRows = useMemo(() => {
    return (templatesQ.data ?? []) as TemplateResponseDTO[];
  }, [templatesQ.data]);

  const rows = useMemo<RowEntry[]>(() => {
    const out: RowEntry[] = [];

    if (showFolders) {
      for (const f of folderRows) {
        const id = Number((f as any)?.id ?? 0);
        if (!id) continue;

        out.push({
          kind: "FOLDER",
          id,
          name: String((f as any)?.name ?? `Folder #${id}`),
          raw: f,
        });
      }
    }

    for (const t of templateRows) {
      const id = Number((t as any)?.id ?? 0);
      if (!id) continue;

      out.push({
        kind: "TPL",
        id,
        raw: t,
      });
    }

    return out;
  }, [showFolders, folderRows, templateRows]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      if (showFolders) foldersQ.clearStatus?.();
      templatesQ.clearStatus?.();

      await Promise.allSettled([
        showFolders ? Promise.resolve(foldersQ.refresh?.()) : Promise.resolve(),
        Promise.resolve(templatesQ.refresh?.()),
      ]);
    },
  ]);

  const onRefreshSafe = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  const foldersQueryErrorMessage = useMemo(() => {
    if (!showFolders) return null;
    if (!foldersQ.error) return null;
    if ((foldersQ.data?.length ?? 0) > 0) return null;
    return toUserMessage(foldersQ.error, "Greška pri učitavanju mapa.");
  }, [showFolders, foldersQ.error, foldersQ.data?.length]);

  const templatesQueryErrorMessage = useMemo(() => {
    if (!templatesQ.error) return null;
    if ((templatesQ.data?.length ?? 0) > 0) return null;
    return toUserMessage(templatesQ.error, "Greška pri učitavanju predložaka.");
  }, [templatesQ.error, templatesQ.data?.length]);

  const topError = foldersQueryErrorMessage || templatesQueryErrorMessage || null;

  const onTopErrorAction = useCallback(async () => {
    if (showFolders) foldersQ.clearStatus?.();
    templatesQ.clearStatus?.();
    await onRefreshSafe();
  }, [showFolders, foldersQ, templatesQ, onRefreshSafe]);

  const anyLoadingMore = (showFolders && foldersQ.loadingMore) || templatesQ.loadingMore;
  const nextLoadMoreError = (showFolders ? foldersQ.loadMoreError : null) || templatesQ.loadMoreError || null;

  const showFooterLoadMore = !!anyLoadingMore;
  const showFooterLoadMoreError = !!nextLoadMoreError;

  const isInitialLoading = (((showFolders && foldersQ.isLoading) || templatesQ.isLoading) && !refreshing);

  const breadcrumb = useMemo(() => folderStack.map((x) => x.name).join(" / "), [folderStack]);

  const openFolder = (f: FolderResponseDTO) => {
    const id = Number((f as any)?.id ?? 0);
    if (!id) return;

    setFolderId(id);
    setFolderStack((cur) => [...cur, { id, name: String((f as any)?.name ?? `Folder #${id}`) }]);
  };

  const goBackFolder = () => {
    setFolderStack((cur) => {
      if (cur.length <= 1) return cur;

      const next = cur.slice(0, -1);
      const last = next[next.length - 1];
      setFolderId(last?.id ?? null);

      return next;
    });
  };

  const pick = (tpl: TemplateResponseDTO) => {
    const tplId = Number((tpl as any)?.id ?? 0);
    if (!tplId) return;

    patchDraft(sessionId, partnerId, { templateId: tplId, docPatches: [], standaloneQty: {} });
    router.back();
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader
        title="Odaberi predložak"
        fallbackHref={{
          pathname: "/(tabs)/sessions/[id]/entry" as const,
          params: { id: String(sessionId), partnerId: String(partnerId) },
        }}
      />

      <View style={s.wrap}>
        {!!topError && (
          <ErrorCard
            title="Greška"
            message={topError}
            actionText="Pokušaj ponovno"
            onAction={onTopErrorAction}
            titleLines={1}
            messageLines={3}
          />
        )}

        <View style={s.tabs}>
          <Pressable
            style={[s.tabBtn, tab === "mine" && s.tabBtnActive]}
            onPress={() => setTab("mine")}
          >
            <Text style={[s.tabText, tab === "mine" && s.tabTextActive]}>Moji</Text>
          </Pressable>

          <Pressable
            style={[s.tabBtn, tab === "shared" && s.tabBtnActive]}
            onPress={() => setTab("shared")}
          >
            <Text style={[s.tabText, tab === "shared" && s.tabTextActive]}>Dijeljeni</Text>
          </Pressable>
        </View>

        <View style={s.searchWrap}>
          <FontAwesome name="search" size={14} color={Colors.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pretraži predloške…"
            placeholderTextColor={PLACEHOLDER}
            style={s.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!q && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <FontAwesome name="times-circle" size={16} color={Colors.sub} />
            </Pressable>
          )}
        </View>

        {showFolders ? (
          <View style={s.breadcrumbRow}>
            <Pressable
              style={[s.folderBackBtn, folderStack.length <= 1 && { opacity: 0.4 }]}
              disabled={folderStack.length <= 1}
              onPress={goBackFolder}
            >
              <FontAwesome name="chevron-left" size={14} color={Colors.text} />
              <Text style={s.folderBackText}>Nazad</Text>
            </Pressable>

            <Text style={s.breadcrumbText} numberOfLines={1}>
              {breadcrumb}
            </Text>
          </View>
        ) : null}

        {isInitialLoading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.muted}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            style={s.list}
            data={rows}
            keyExtractor={(x) => `${x.kind}-${x.id}`}
            refreshing={refreshing}
            onRefresh={onRefreshSafe}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.listContent, { paddingBottom: listBottomPad }]}
            scrollIndicatorInsets={{ bottom: listBottomPad }}
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (
                refreshing ||
                (showFolders && (foldersQ.loading || foldersQ.loadingMore)) ||
                templatesQ.loading ||
                templatesQ.loadingMore
              ) {
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
              if (item.kind === "FOLDER") {
                return (
                  <Pressable style={[s.row, s.folderRow]} onPress={() => openFolder(item.raw)}>
                    <FontAwesome name="folder" size={16} color={Colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={s.rowSub} numberOfLines={1}>
                        Folder • ID: {item.id}
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                  </Pressable>
                );
              }

              const tpl: any = item.raw;
              const perm = String(tpl?.sharedPermission ?? "").toUpperCase();
              const permLabel = tab === "shared" ? (perm ? `Dijeljeni • ${perm}` : "Dijeljeni") : "Moj";
              const docTypes = summarizeDocTypes(tpl);

              return (
                <Pressable style={s.row} onPress={() => pick(item.raw)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={2}>
                      {tpl?.name ?? `Predložak #${tpl?.id}`}
                    </Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      #{tpl?.id} • {permLabel}
                    </Text>
                    <Text style={s.rowDocType} numberOfLines={1}>
                      {docTypes}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
            ListFooterComponent={
              showFooterLoadMore || showFooterLoadMoreError ? (
                <View style={s.footerWrap}>
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
                      style={s.footerRetryBtn}
                    >
                      <Text style={s.footerRetryText}>
                        {String(nextLoadMoreError)} • Dodirni za pokušaj ponovno
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    padding: 14,
    gap: 12,
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
  },

  tabs: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "rgba(249,115,22,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
  },
  tabText: { fontWeight: "900", color: Colors.sub },
  tabTextActive: { color: Colors.text },

  searchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: {
    flex: 1,
    height: 24,
    paddingVertical: 0,
    fontWeight: "800",
    color: Colors.text,
    fontSize: 14,
  },

  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  folderBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  folderBackText: { fontWeight: "900", color: Colors.text },
  breadcrumbText: { flex: 1, fontWeight: "800", color: Colors.sub },

  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 10,
  },

  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  folderRow: {
    backgroundColor: "rgba(148,163,184,0.10)",
    borderColor: "rgba(148,163,184,0.30)",
  },

  rowTitle: { fontWeight: "900", color: Colors.text },
  rowSub: { color: Colors.sub, fontWeight: "800", marginTop: 2 },
  rowDocType: { color: Colors.sub, fontWeight: "800", marginTop: 6 },

  center: { padding: 20, alignItems: "center", gap: 10 },
  muted: { color: Colors.sub, fontWeight: "800" },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },

  footerWrap: {
    paddingVertical: 12,
    alignItems: "center",
    gap: 8,
  },
  footerRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  footerRetryText: {
    color: Colors.text,
    fontWeight: "700",
  },
});