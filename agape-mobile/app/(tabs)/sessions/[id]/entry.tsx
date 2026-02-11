// app/(tabs)/sessions/[id]/entry.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import TemplatesHeader from "@/app/(tabs)/templates/TemplatesHeader";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  TemplateResponseDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
} from "@/app/models/generated";

import { dispatchTemplateService } from "@/app/api/services/dispatchTemplateService";
import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession, useUpsertBookingSessionEntry } from "@/app/api/hooks/useBookingSessions";
import { QtyMap, useEntryDraft, getDraft, setDraft, clearDraft, patchDraft } from "../_entryDraftStore";

const MAX_W = 560;

function qtyToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0);
}

function mkPatch(docId: number, addItems: TemplateBookItemDTO[]): TemplateBookDocPatchDTO {
  return {
    documentId: docId,
    addItems,
    setItems: [],
    removeItemIds: [],
    draftOverride: null as any,
    noteOverride: null as any,
  } as any;
}

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) return s.slice(1, -1);
  return s;
}

export default function SessionEntryEditor() {
  const params = useLocalSearchParams<{ id: string; partnerId: string }>();
  const sessionId = Number(params.id);
  const partnerId = Number(params.partnerId);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const upsertM = useUpsertBookingSessionEntry(sessionId);

  const draft = useEntryDraft(sessionId, partnerId);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateResponseDTO | null>(null);

  // partner name for header
  const [partnerName, setPartnerName] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // try from session entries first (if backend already sends name somewhere)
        const hitFromSession =
          ((session as any)?.entries ?? []).find((e: any) => Number(e.partnerId) === Number(partnerId)) ?? null;

        const maybeName =
          cleanText((hitFromSession as any)?.partnerName) ||
          cleanText((hitFromSession as any)?.partner?.name) ||
          "";

        if (maybeName) {
          if (!alive) return;
          setPartnerName(maybeName);
          return;
        }

        // fallback: search partner by id via service
        const res = await partnerService.pagePartners({ page: 0, size: 10, q: String(partnerId) });
        const hit = (res.items ?? []).find((p: any) => Number(p.id) === Number(partnerId)) ?? null;

        if (!alive) return;
        setPartnerName(cleanText((hit as any)?.name) || "");
      } catch {
        if (!alive) return;
        setPartnerName("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [partnerId, session?.id, (session as any)?.entries?.length]);

  const headerTitle = partnerName?.trim()
    ? `Unos • ${partnerName} (ID: ${partnerId})`
    : `Unos • Partner #${partnerId}`;

  // init draft from session entry (once)
  useEffect(() => {
    if (!session) return;

    const existing = ((session as any).entries ?? []).find(
      (e: any) => Number(e.partnerId) === partnerId
    ) as BookingSessionEntryResponseDTO | undefined;

    const cur = getDraft(sessionId, partnerId);
    if (cur) return;

    const init = {
      sessionId,
      partnerId,
      draftMode: ((existing as any)?.draftMode ?? "DRAFT") as any,
      templateId: Number((existing as any)?.templateId ?? 0) || null,
      docPatches: Array.isArray((existing as any)?.docPatches) ? (existing as any).docPatches : [],
      standaloneQty: {},
      note: (existing as any)?.note ?? null,
      documentDate: (existing as any)?.documentDate ?? null,
    };

    setDraft(init as any);
  }, [session?.id, partnerId]);

  // load selected template by id
  useEffect(() => {
    let alive = true;

    (async () => {
      const tplId = Number(draft?.templateId ?? 0);
      if (!tplId) {
        setSelectedTemplate(null);
        return;
      }
      try {
        const full = await dispatchTemplateService.getTemplate(tplId);
        if (!alive) return;
        setSelectedTemplate(full as any);
      } catch {
        if (!alive) return;
        setSelectedTemplate(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draft?.templateId]);

  const templateDocs = useMemo(() => (((selectedTemplate as any)?.documents ?? []) as any[]), [selectedTemplate]);

  const patchByDocId = useMemo(() => {
    const m = new Map<number, any>();
    (draft?.docPatches ?? []).forEach((p: any) => m.set(Number(p.documentId), p));
    return m;
  }, [draft?.docPatches]);

  const err = (sQ.error as any)?.message || (upsertM.error as any)?.message || null;

  const openTemplatePicker = () => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/template" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const openStandaloneItems = () => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/items" as const,
      params: { id: String(sessionId), partnerId: String(partnerId), target: "standalone" },
    });
  };

  const openDocItems = (docId: number) => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/items" as const,
      params: { id: String(sessionId), partnerId: String(partnerId), target: "doc", documentId: String(docId) },
    });
  };

  const save = async () => {
    if (!session || (session as any).status !== "DRAFT") return;
    if (!draft) return;

    const tplId = Number(draft.templateId ?? 0);
    if (!tplId) return;

    let docPatches = [...(draft.docPatches ?? [])];

    // standaloneQty -> merge into first template doc (same logic you had)
    const standaloneItems = qtyToItems(draft.standaloneQty ?? {});
    if (standaloneItems.length && templateDocs.length) {
      const docId = Number(templateDocs?.[0]?.documentId ?? templateDocs?.[0]?.document_id ?? 0);
      if (docId) {
        const idx = docPatches.findIndex((p: any) => Number(p.documentId) === docId);

        if (idx === -1) {
          docPatches.push(mkPatch(docId, standaloneItems));
        } else {
          const cur = Array.isArray(docPatches[idx]?.addItems) ? docPatches[idx].addItems : [];
          const by = new Map<number, number>();

          [...cur, ...standaloneItems].forEach((x: any) => {
            const id = Number(x.itemId);
            const q = Number(x.quantity ?? 0);
            if (!id || q <= 0) return;
            by.set(id, (by.get(id) ?? 0) + q);
          });

          docPatches[idx] = {
            ...docPatches[idx],
            addItems: Array.from(by.entries()).map(([itemId, quantity]) => ({ itemId, quantity })),
          };
        }
      }
    }

    const payload: BookingSessionEntryUpsertRequestDTO = {
      partnerId: Number(draft.partnerId),
      templateId: tplId,
      draftMode: draft.draftMode as any,
      documentDate: (draft as any).documentDate ?? null,
      docPatches: docPatches as any,
      extraItems: [] as any,
      note: (draft as any).note ?? null,
    } as any;

    await upsertM.mutateAsync(payload);
    clearDraft(sessionId, partnerId);
    await sQ.refetch();
    router.back();
  };

  if (!draft) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TemplatesHeader
          title="Unos"
          fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }}
        />
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
        fallbackHref={{ pathname: "/(tabs)/sessions/[id]" as const, params: { id: String(sessionId) } }}
      />

      <View style={st.wrap}>
        {!!err && <Banner type="error" text={String(err)} />}

        <Text style={st.label}>Način</Text>
        <View style={st.segmentRow}>
          <Pressable
            style={[st.segBtn, draft.draftMode === "DRAFT" && st.segBtnOn]}
            onPress={() => patchDraft(sessionId, partnerId, { draftMode: "DRAFT" })}
          >
            <Text style={[st.segText, draft.draftMode === "DRAFT" && st.segTextOn]}>Draft</Text>
          </Pressable>

          <Pressable
            style={[st.segBtn, draft.draftMode === "FINAL" && st.segBtnOn]}
            onPress={() => patchDraft(sessionId, partnerId, { draftMode: "FINAL" })}
          >
            <Text style={[st.segText, draft.draftMode === "FINAL" && st.segTextOn]}>Final</Text>
          </Pressable>
        </View>

        <View style={st.sectionHeader}>
          <Text style={st.label}>Predložak</Text>
          <Pressable style={st.smallBtn} onPress={openTemplatePicker}>
            <Text style={st.smallBtnText}>Odaberi</Text>
          </Pressable>
        </View>

        {selectedTemplate ? (
          <View style={[st.pickRow, { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.35)" }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.pickTitle}>{(selectedTemplate as any).name}</Text>
              <Text style={st.pickSub}>
                #{(selectedTemplate as any).id} • dokumenata: {(selectedTemplate as any).documents?.length ?? 0}
              </Text>
            </View>

            <Pressable
              style={[st.iconBtn, { width: 40, height: 40 }]}
              onPress={() => {
                patchDraft(sessionId, partnerId, { templateId: null, docPatches: [], standaloneQty: {} });
                setSelectedTemplate(null);
              }}
            >
              <FontAwesome name="trash" size={16} color={Colors.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={st.helper}>Nije odabran predložak.</Text>
        )}

        <View style={st.sectionHeader}>
          <Text style={st.label}>Dodatne stavke</Text>
          <Pressable style={st.smallBtn} onPress={openStandaloneItems}>
            <Text style={st.smallBtnText}>Dodaj stavke</Text>
          </Pressable>
        </View>

        {selectedTemplate ? (
          <>
            <Text style={st.label}>Dokumenti</Text>

            {templateDocs.length === 0 ? (
              <Text style={st.helper}>Predložak nema dokumenata.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {templateDocs.map((d: any) => {
                  const docId = Number(d.documentId ?? d.document_id ?? 0);
                  const p = patchByDocId.get(docId);
                  const added = ((p as any)?.addItems?.length ?? 0) as number;

                  return (
                    <View key={String(docId)} style={st.docCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.docTitle}>Dokument #{docId}</Text>
                        <Text style={st.docSub}>Dodano: {added}</Text>
                      </View>

                      {/* <Pressable style={st.smallBtn} onPress={() => openDocItems(docId)}>
                        <Text style={st.smallBtnText}>Dodaj stavke</Text>
                      </Pressable> */}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        <Pressable
          style={[st.primaryBtn, (!draft.templateId || upsertM.isPending) && { opacity: 0.5 }]}
          disabled={!draft.templateId || upsertM.isPending}
          onPress={save}
        >
          {upsertM.isPending ? <ActivityIndicator /> : <Text style={st.primaryText}>Spremi</Text>}
        </Pressable>

        <Pressable
          style={[st.ghostBtn, upsertM.isPending && { opacity: 0.6 }]}
          disabled={upsertM.isPending}
          onPress={() => {
            if (upsertM.isPending) return;
            clearDraft(sessionId, partnerId);
            router.back();
          }}
        >
          <Text style={st.ghostText}>Zatvori</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, gap: 12, alignSelf: "center", width: "100%", maxWidth: MAX_W },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },
  label: { fontWeight: "900", color: Colors.text },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  primaryBtn: { paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  ghostBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { fontWeight: "900", color: Colors.text },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },

  pickRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickTitle: { fontWeight: "900", color: Colors.text },
  pickSub: { color: Colors.sub, fontWeight: "800" },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  docCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docTitle: { fontWeight: "900", color: Colors.text },
  docSub: { color: Colors.sub, fontWeight: "800" },

  segmentRow: { flexDirection: "row", gap: 10 },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" },
  segText: { fontWeight: "900", color: Colors.sub },
  segTextOn: { color: Colors.text },
});
