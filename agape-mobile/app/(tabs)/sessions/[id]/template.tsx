// app/(tabs)/sessions/[id]/template.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import TemplatesHeader from "@/app/(tabs)/templates/TemplatesHeader";

import type { FolderResponseDTO, TemplateDocResponseDTO, TemplateResponseDTO } from "@/app/models/generated";
import { dispatchTemplateService } from "@/app/api/services/dispatchTemplateService";
import { patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PLACEHOLDER = "rgba(148,163,184,0.85)";
const SEARCH_DEBOUNCE_MS = 220;

type ScopeTab = "mine" | "shared";

function isTemplateInFolder(t: any, folderId: number | null) {
  const fid = t?.folderId ?? t?.folder?.id ?? null;
  if (folderId == null) return fid == null;
  return Number(fid ?? 0) === Number(folderId ?? 0);
}

function normDocDocumentId(d: any): number {
  return Number(d?.documentId ?? d?.document_id ?? d?.document?.id ?? d?.document?.documentId ?? 0);
}
function normDocLabel(d: any): string {
  // Prefer explicit "documentName" / "documentCode" if backend supplies it.
  const name = String(d?.documentName ?? d?.document?.name ?? d?.name ?? "").trim();
  const code = String(d?.documentCode ?? d?.document?.code ?? d?.code ?? "").trim();
  const docId = normDocDocumentId(d);
  if (name) return name;
  if (code) return code;
  if (docId) return `Dokument #${docId}`;
  // fallback to template-doc id if nothing
  const tid = Number(d?.id ?? 0);
  return tid ? `Doc #${tid}` : "Dokument";
}

function summarizeDocTypes(tpl: any): string {
  const docs = ((tpl as any)?.documents ?? (tpl as any)?.docs ?? []) as any[];
  const labels = docs.map(normDocLabel).filter(Boolean);

  // keep it short: unique, first 2 + “+N”
  const uniq: string[] = [];
  for (const x of labels) {
    const k = x.trim();
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

  const [tab, setTab] = useState<ScopeTab>("mine");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // folders (mine only)
  const [folders, setFolders] = useState<FolderResponseDTO[]>([]);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<Array<{ id: number | null; name: string }>>([{ id: null, name: "Root" }]);

  // lists
  const [mineAll, setMineAll] = useState<TemplateResponseDTO[]>([]);
  const [sharedAll, setSharedAll] = useState<TemplateResponseDTO[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  // load folders once (for browsing my templates)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await dispatchTemplateService.listFolders();
        if (!alive) return;
        setFolders((list ?? []) as any);
      } catch {
        if (!alive) return;
        setFolders([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const childFolders = useMemo(() => {
    return (folders ?? []).filter((f: any) => {
      const pid = (f as any)?.parentId ?? (f as any)?.parent?.id ?? null;
      return Number(pid ?? 0) === Number(folderId ?? 0);
    });
  }, [folders, folderId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const name = debouncedQ || "";

        // 1) My templates for current folder context
        const mineParams = {
          folderId: folderId == null ? null : folderId,
          name,
          includeShared: false,
          rootOnly: folderId == null,
        };

        const mine = (await dispatchTemplateService.listTemplates(mineParams as any)) ?? [];
        if (!alive) return;
        setMineAll(mine as any);

        // 2) shared-only = mixed(includeShared=true) - mineRoot(includeShared=false)
        const mixedParams = {
          folderId: null,
          name,
          includeShared: true,
          rootOnly: false,
        };
        const mixed = (await dispatchTemplateService.listTemplates(mixedParams as any)) ?? [];
        if (!alive) return;

        const mineRootParams = {
          folderId: null,
          name,
          includeShared: false,
          rootOnly: false,
        };
        const mineRoot = (await dispatchTemplateService.listTemplates(mineRootParams as any)) ?? [];

        const mineIds = new Set((mineRoot as any[]).map((t: any) => String(t?.id)));
        const sharedOnly = (mixed as any[]).filter((t: any) => !mineIds.has(String(t?.id)));

        setSharedAll(sharedOnly as any);
      } catch (e: any) {
        if (!alive) return;
        setMineAll([]);
        setSharedAll([]);
        setLoadError(e?.message ?? "Greška pri dohvaćanju predložaka.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [folderId, debouncedQ]);

  const breadcrumb = useMemo(() => folderStack.map((x) => x.name).join(" / "), [folderStack]);

  const pick = (t: any) => {
    const tplId = Number(t?.id ?? 0);
    if (!tplId) return;
    patchDraft(sessionId, partnerId, { templateId: tplId, docPatches: [], standaloneQty: {} });
    router.back();
  };

  const openFolder = (f: any) => {
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

  const currentTemplates = useMemo(() => (tab === "shared" ? sharedAll : mineAll), [tab, mineAll, sharedAll]);
  const showFolders = tab === "mine";

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TemplatesHeader
        title="Odaberi predložak"
        fallbackHref={{ pathname: "/(tabs)/sessions/[id]/entry" as const, params: { id: String(sessionId), partnerId: String(partnerId) } }}
      />

      <View style={s.wrap}>
        {/* tabs */}
        <View style={s.tabs}>
          <Pressable style={[s.tabBtn, tab === "mine" && s.tabBtnActive]} onPress={() => setTab("mine")}>
            <Text style={[s.tabText, tab === "mine" && s.tabTextActive]}>Moji</Text>
          </Pressable>

          <Pressable style={[s.tabBtn, tab === "shared" && s.tabBtnActive]} onPress={() => setTab("shared")}>
            <Text style={[s.tabText, tab === "shared" && s.tabTextActive]}>Dijeljeni</Text>
          </Pressable>
        </View>

        {/* search */}
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

        {/* breadcrumb only in mine */}
        {showFolders ? (
          <View style={s.breadcrumbRow}>
            <Pressable style={[s.folderBackBtn, folderStack.length <= 1 && { opacity: 0.4 }]} disabled={folderStack.length <= 1} onPress={goBackFolder}>
              <FontAwesome name="chevron-left" size={14} color={Colors.text} />
              <Text style={s.folderBackText}>Nazad</Text>
            </Pressable>

            <Text style={s.breadcrumbText} numberOfLines={1}>
              {breadcrumb}
            </Text>
          </View>
        ) : null}

        {!!loadError && <Text style={s.errText}>{loadError}</Text>}

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.muted}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            data={[...(showFolders ? (childFolders as any[]) : []), ...(currentTemplates as any[])]}
            keyExtractor={(x: any, idx) => {
              const looksLikeFolder = (x as any)?.parentId !== undefined || (x as any)?.parent !== undefined;
              return looksLikeFolder ? `folder-${String((x as any)?.id)}` : `tpl-${String((x as any)?.id)}-${idx}`;
            }}
            contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
            renderItem={({ item }: any) => {
              const looksLikeFolder = showFolders && ((item as any)?.parentId !== undefined || (item as any)?.parent !== undefined);

              if (looksLikeFolder && (item as any)?.id != null && (item as any)?.name != null) {
                return (
                  <Pressable style={[s.row, s.folderRow]} onPress={() => openFolder(item)}>
                    <FontAwesome name="folder" size={16} color={Colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {(item as any).name}
                      </Text>
                      <Text style={s.rowSub} numberOfLines={1}>
                        Folder • ID: {(item as any).id}
                      </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                  </Pressable>
                );
              }

              // template row
              if (tab === "mine" && !isTemplateInFolder(item, folderId)) return null;

              const isShared = tab === "shared";
              const perm = String((item as any)?.sharedPermission ?? "").toUpperCase();
              const permLabel = isShared ? (perm ? `Dijeljeni • ${perm}` : "Dijeljeni") : "Moj";

              const docTypes = summarizeDocTypes(item);

              return (
                <Pressable style={s.row} onPress={() => pick(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={2}>
                      {(item as any).name ?? `Predložak #${(item as any).id}`}
                    </Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      #{(item as any).id} • {permLabel}
                    </Text>

                    {/* ✅ document type line (e.g. Izdatnica, Primka...) */}
                    <Text style={s.rowDocType} numberOfLines={1}>
                      {docTypes}
                    </Text>
                  </View>

                  <FontAwesome name="chevron-right" size={14} color={Colors.sub} />
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
          />
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 14, gap: 12, alignSelf: "center", width: "100%", maxWidth: MAX_W },

  tabs: { width: "100%", flexDirection: "row", gap: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: "rgba(249,115,22,0.18)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(249,115,22,0.35)" },
  tabText: { fontWeight: "900", color: Colors.sub },
  tabTextActive: { color: Colors.text },

  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: { flex: 1, fontWeight: "800", color: Colors.text },

  breadcrumbRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  folderBackBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)" },
  folderBackText: { fontWeight: "900", color: Colors.text },
  breadcrumbText: { flex: 1, fontWeight: "800", color: Colors.sub },

  errText: { color: Colors.dangerText, fontWeight: "900" },

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
  folderRow: { backgroundColor: "rgba(148,163,184,0.10)", borderColor: "rgba(148,163,184,0.30)" },

  rowTitle: { fontWeight: "900", color: Colors.text },
  rowSub: { color: Colors.sub, fontWeight: "800", marginTop: 2 },
  rowDocType: { color: Colors.sub, fontWeight: "800", marginTop: 6 },

  center: { padding: 20, alignItems: "center", gap: 10 },
  muted: { color: Colors.sub, fontWeight: "800" },
  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },
});
