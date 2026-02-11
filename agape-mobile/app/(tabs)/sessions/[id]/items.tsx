// app/(tabs)/sessions/[id]/items.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import TemplatesHeader from "@/app/(tabs)/templates/TemplatesHeader";
import { Banner } from "@/components/Banner";

import type { BookingSessionResponseDTO, ItemDescriptorResponseDTO, PartnerResponseDTO, TemplateBookItemDTO } from "@/app/models/generated";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";
import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession } from "@/app/api/hooks/useBookingSessions";
import { QtyMap, getDraft, patchDraft } from "../_entryDraftStore";

const MAX_W = 560;
const PAGE_SIZE = 10;
const PLACEHOLDER = "rgba(148,163,184,0.85)";

function upsertQty(qty: QtyMap, itemId: number, delta: number) {
  const k = String(itemId);
  const cur = Number(qty[k] ?? 0);
  const next = cur + delta;
  if (next <= 0) {
    const { [k]: _, ...rest } = qty;
    return rest;
  }
  return { ...qty, [k]: next };
}

function qtyToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0);
}

function itemsToQty(items: TemplateBookItemDTO[] | null | undefined): QtyMap {
  const m: QtyMap = {};
  (items ?? []).forEach((it: any) => {
    const id = Number(it.itemId);
    const q = Number(it.quantity ?? 0);
    if (!id || q <= 0) return;
    m[String(id)] = (m[String(id)] ?? 0) + q;
  });
  return m;
}

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) return s.slice(1, -1);
  return s;
}

export default function SessionItemsPicker() {
  const params = useLocalSearchParams<{ id: string; partnerId: string; target: string; documentId?: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);
  const target = String(params.target || "standalone");
  const documentId = params.documentId ? Number(params.documentId) : null;

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const draft = getDraft(sessionId, partnerId);

  // partner label (name + partnerNumber + id)
  const [partner, setPartner] = useState<PartnerResponseDTO | null>(null);
  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;

    (async () => {
      try {
        // nema "getById", pa radimo page pretragu po ID-u i pogodimo exact
        const res = await partnerService.pagePartners({ page: 0, size: 15, q: String(partnerId) });
        const hit = (res.items ?? []).find((p: any) => Number(p?.id) === Number(partnerId)) ?? null;
        if (cancelled) return;
        setPartner(hit as any);
      } catch {
        if (cancelled) return;
        setPartner(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  const partnerTitle = useMemo(() => {
    const nm = cleanText((partner as any)?.name);
    const pn = (partner as any)?.partnerNumber;
    if (nm) return `${nm}${pn ? ` • #${pn}` : ""} • (ID: ${partnerId})`;
    return `Partner ID: ${partnerId}`;
  }, [partnerId, partner]);

  // UI state (same as otpremi)
  const [itemsTab, setItemsTab] = useState<"results" | "added">("results");
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);

  const [qtyDraft, setQtyDraft] = useState<QtyMap>({});

  const [rows, setRows] = useState<ItemDescriptorResponseDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // init qty from store (standalone vs doc patch)
  useEffect(() => {
    if (!draft) return;

    if (target === "standalone") {
      setQtyDraft({ ...(draft.standaloneQty ?? {}) });
      return;
    }

    const docId = Number(documentId ?? 0);
    if (!docId) return;

    const p = (draft.docPatches ?? []).find((x: any) => Number(x.documentId) === docId);
    setQtyDraft(itemsToQty((p?.addItems ?? []) as any));
  }, [sessionId, partnerId, target, documentId]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  // reset page on query change
  useEffect(() => setPage(0), [debouncedQ]);

  // load items page
  useEffect(() => {
    if (!session?.warehouseId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await itemDirectoryService.pageItems({
          warehouseId: Number((session as any).warehouseId),
          page,
          size: PAGE_SIZE,
          q: debouncedQ || "",
        });

        if (!alive) return;
        setRows((res.items ?? []) as any);
        setTotal(Number((res as any).total ?? 0));
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setTotal(0);
        setLoadError(e?.message ?? "Greška pri dohvaćanju artikala.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [session?.warehouseId, page, debouncedQ]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  const headerTitle = target === "standalone" ? "Dodane stavke" : `Stavke • Dokument #${documentId ?? ""}`;

  const headerSubtitle = useMemo(() => {
    const wh = (session as any)?.warehouseId ? `Skladište #${(session as any).warehouseId}` : "Nema skladišta";
    return `${partnerTitle} • ${wh}`;
  }, [partnerTitle, session]);

  const apply = () => {
    if (!draft) return;

    if (target === "standalone") {
      patchDraft(sessionId, partnerId, { standaloneQty: qtyDraft });
      router.back();
      return;
    }

    const docId = Number(documentId ?? 0);
    if (!docId) return;

    const items = qtyToItems(qtyDraft);
    const next = [...(draft.docPatches ?? [])];
    const idx = next.findIndex((p: any) => Number(p.documentId) === docId);

    if (items.length === 0) {
      if (idx >= 0) next.splice(idx, 1);
    } else {
      if (idx === -1) {
        next.push({
          documentId: docId,
          addItems: items,
          setItems: [],
          removeItemIds: [],
          draftOverride: null,
          noteOverride: null,
        } as any);
      } else {
        next[idx] = { ...next[idx], addItems: items as any };
      }
    }

    patchDraft(sessionId, partnerId, { docPatches: next });
    router.back();
  };

  const bumpQty = (itemId: number, delta: number) => setQtyDraft((cur) => upsertQty(cur, Number(itemId), delta));

  const setQtyFor = (itemId: number, qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    setQtyDraft((cur) => ({ ...cur, [String(itemId)]: qty }));
  };

  const removeItem = (itemId: number) => {
    setQtyDraft((cur) => {
      const k = String(itemId);
      const { [k]: _, ...rest } = cur;
      return rest;
    });
  };

  const addedList = useMemo(
    () => qtyToItems(qtyDraft).slice().sort((a, b) => Number(a.itemId) - Number(b.itemId)),
    [qtyDraft]
  );

  if (!draft) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TemplatesHeader title="Stavke" fallbackHref={{ pathname: "/(tabs)/sessions/[id]/entry" as const, params: { id: String(sessionId), partnerId: String(partnerId) } }} />
        <View style={{ padding: 16, alignItems: "center", gap: 10 }}>
          <ActivityIndicator />
          <Text style={{ color: Colors.sub, fontWeight: "800" }}>Učitavam…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TemplatesHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        fallbackHref={{ pathname: "/(tabs)/sessions/[id]/entry" as const, params: { id: String(sessionId), partnerId: String(partnerId) } }}
      />

      <View style={s.container}>
        {!session?.warehouseId ? <Banner type="error" text="Nema warehouseId za ovu sesiju." /> : null}

        <View style={s.centerBlock}>
          <View style={s.tabs}>
            <Pressable style={[s.tabBtn, itemsTab === "results" && s.tabBtnActive]} onPress={() => setItemsTab("results")}>
              <Text style={[s.tabText, itemsTab === "results" && s.tabTextActive]}>Rezultati</Text>
            </Pressable>
            <Pressable style={[s.tabBtn, itemsTab === "added" && s.tabBtnActive]} onPress={() => setItemsTab("added")}>
              <Text style={[s.tabText, itemsTab === "added" && s.tabTextActive]}>Dodano ({addedList.length})</Text>
            </Pressable>
          </View>

          {itemsTab === "results" ? (
            <>
              <TextInput
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="Pretraži artikle (naziv, šifra)…"
                placeholderTextColor={PLACEHOLDER}
                style={s.input}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {!!loadError && <Banner type="error" text={loadError} />}

              <View style={s.block}>
                <Text style={s.blockTitle}>Rezultati</Text>

                {loading ? (
                  <View style={{ paddingVertical: 12, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : rows.length === 0 ? (
                  <Text style={s.muted}>Nema rezultata.</Text>
                ) : (
                  <View style={{ gap: 10, alignSelf: "stretch" }}>
                    {rows.map((it: any) => {
                      const itemId = Number(it.itemId ?? it.id ?? it.item_id ?? 0);
                      if (!itemId) return null;

                      const name = String(it.name ?? it.itemName ?? it.naziv ?? "").trim();
                      const code = String(it.code ?? it.itemCode ?? it.sifra ?? "").trim();
                      const unit = String(it.unit ?? it.jmj ?? "").trim();

                      return (
                        <View key={String(itemId)} style={s.resultRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemNameStrong} numberOfLines={2}>
                              {name || `Artikl #${itemId}`}
                            </Text>
                            {!![code, unit].filter(Boolean).length && (
                              <Text style={s.itemMeta} numberOfLines={1}>
                                {[code ? `Šifra: ${code}` : null, unit ? `JMJ: ${unit}` : null, `ID: ${itemId}`].filter(Boolean).join(" • ")}
                              </Text>
                            )}
                          </View>

                          <Pressable
                            style={s.addBtn}
                            onPress={() => {
                              setQtyDraft((cur) => upsertQty(cur, itemId, 1));
                              setItemsTab("added");
                            }}
                          >
                            <Text style={s.addBtnText}>+1</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={s.pager}>
                  <Pressable style={[s.pagerBtn, !canPrev && { opacity: 0.4 }]} disabled={!canPrev} onPress={() => setPage((p) => Math.max(0, p - 1))}>
                    <FontAwesome name="chevron-left" size={14} color={Colors.text} />
                  </Pressable>

                  <Text style={s.pagerText}>
                    Str. {page + 1} / {totalPages}
                  </Text>

                  <Pressable style={[s.pagerBtn, !canNext && { opacity: 0.4 }]} disabled={!canNext} onPress={() => setPage((p) => p + 1)}>
                    <FontAwesome name="chevron-right" size={14} color={Colors.text} />
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <View style={s.block}>
              <Text style={s.blockTitle}>Dodane stavke</Text>

              {addedList.length === 0 ? (
                <Text style={s.muted}>Još nema dodanih stavki. Dodaj iz “Rezultati”.</Text>
              ) : (
                <View style={{ gap: 10, alignSelf: "stretch" }}>
                  {addedList.map((x) => (
                    <View key={String(x.itemId)} style={s.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemNameStrong} numberOfLines={2}>
                          Artikl #{x.itemId}
                        </Text>
                        <Text style={s.itemMeta} numberOfLines={1}>
                          ID: {x.itemId}
                        </Text>
                      </View>

                      <View style={s.qtyBox}>
                        <Pressable style={s.qtyBtn} onPress={() => bumpQty(x.itemId, -1)}>
                          <Text style={s.qtyBtnText}>−</Text>
                        </Pressable>

                        <TextInput
                          value={String(x.quantity)}
                          onChangeText={(v) => {
                            const n = Number(String(v).replace(",", "."));
                            if (!Number.isFinite(n)) return;
                            setQtyFor(x.itemId, n);
                          }}
                          keyboardType="numeric"
                          placeholder="1"
                          placeholderTextColor={PLACEHOLDER}
                          style={s.qtyInput}
                        />

                        <Pressable style={s.qtyBtn} onPress={() => bumpQty(x.itemId, +1)}>
                          <Text style={s.qtyBtnText}>+</Text>
                        </Pressable>
                      </View>

                      <Pressable style={s.smallDangerBtn} onPress={() => removeItem(x.itemId)}>
                        <Text style={s.smallDangerText}>X</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <Pressable style={[s.primary, !session?.warehouseId && { opacity: 0.5 }]} onPress={apply} disabled={!session?.warehouseId}>
            <Text style={s.primaryText}>Primijeni</Text>
          </Pressable>

          <Pressable style={s.btnWide} onPress={() => router.back()}>
            <Text style={s.btnText}>Zatvori</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  centerBlock: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 12, alignItems: "center" },

  primary: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  btnWide: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.30)",
  },
  btnText: { fontWeight: "900", color: Colors.text },

  tabs: { width: "100%", maxWidth: MAX_W, flexDirection: "row", gap: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.28)",
  },
  tabBtnActive: { backgroundColor: "rgba(249,115,22,0.20)", borderColor: "rgba(249,115,22,0.45)" },
  tabText: { fontWeight: "900", color: Colors.sub },
  tabTextActive: { color: Colors.text },

  input: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W,
    backgroundColor: Colors.bg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },

  block: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.32)",
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  blockTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  resultRow: {
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.40)",
    backgroundColor: Colors.bg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(249,115,22,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { fontWeight: "900", color: Colors.text },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  pagerBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.20)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.35)",
  },
  pagerText: { fontWeight: "900", color: Colors.sub },

  itemRow: {
    alignSelf: "center",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.40)",
    backgroundColor: Colors.bg,
  },

  itemNameStrong: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  itemMeta: { color: Colors.sub, fontWeight: "800" },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderRadius: 14,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.28)",
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.20)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.35)",
  },
  qtyBtnText: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  qtyInput: { width: 58, textAlign: "center", fontWeight: "900", color: Colors.text, paddingVertical: 6 },

  smallDangerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
  },
  smallDangerText: { fontWeight: "900", color: Colors.dangerText },

  muted: { color: Colors.sub, fontWeight: "700" },
});
