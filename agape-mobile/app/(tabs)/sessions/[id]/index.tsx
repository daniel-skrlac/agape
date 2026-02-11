import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import TemplatesHeader from "@/app/(tabs)/templates/TemplatesHeader";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import type { BookingSessionEntryResponseDTO, BookingSessionResponseDTO, PartnerResponseDTO } from "@/app/models/generated";
import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession, useDeleteBookingSessionEntry, useFinalizeBookingSession } from "@/app/api/hooks/useBookingSessions";

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) return s.slice(1, -1);
  return s;
}
function cleanDescription(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  const s = cleanText(v).trim();
  if (!s) return null;
  if (s.replace(/\s/g, "") === "[]") return null;
  return s;
}
function badgeStyle(status: any) {
  if (status === "FINALIZED") return { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.35)" };
  if (status === "CANCELLED") return { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.35)" };
  return { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" };
}
function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

export default function SessionDetailIndex() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const delEntryM = useDeleteBookingSessionEntry(sessionId);
  const finalizeM = useFinalizeBookingSession(sessionId);

  const err = (sQ.error as any)?.message || (delEntryM.error as any)?.message || (finalizeM.error as any)?.message || null;

  const headerTitle = cleanText((session as any)?.title) || "";

  const [partnerById, setPartnerById] = useState<Record<string, PartnerResponseDTO>>({});
  const partnerLabel = (partnerId: number | null | undefined) => {
    const p = partnerId ? partnerById[String(partnerId)] : null;
    if (p?.name) return `${p.name} (#${(p as any).id})`;
    return partnerId ? `Partner #${partnerId}` : "Partner";
  };

  useEffect(() => {
    const ids = (session?.entries ?? []).map((e: any) => Number(e.partnerId)).filter(Boolean);
    const missing = ids.filter((id) => !partnerById[String(id)]);
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      for (const id of missing.slice(0, 25)) {
        try {
          const res = await partnerService.pagePartners({ page: 0, size: 10, q: String(id) });
          const hit = (res.items ?? []).find((p: any) => Number(p.id) === Number(id)) ?? null;
          if (!hit) continue;
          if (cancelled) return;
          setPartnerById((cur) => ({ ...cur, [String((hit as any).id)]: hit }));
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, (session?.entries ?? []).length]);

  const openPartnerPicker = () => {
    router.push({ pathname: "/(tabs)/sessions/[id]/partner" as const, params: { id: String(sessionId) } });
  };

  const openEntry = (partnerId: number) => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/entry" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  const finalize = async () => {
    await finalizeM.mutateAsync();
    await sQ.refetch();
  };

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePid, setDeletePid] = useState<number | null>(null);
  const [deleteLbl, setDeleteLbl] = useState("");

  const askDelete = (pid: number) => {
    setDeletePid(pid);
    setDeleteLbl(partnerLabel(pid));
    setDeleteOpen(true);
  };

  const deleteEntry = async () => {
    if (!deletePid) return;
    await delEntryM.mutateAsync(Number(deletePid));
    setDeleteOpen(false);
    setDeletePid(null);
    await sQ.refetch();
  };

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TemplatesHeader title={headerTitle} fallbackHref="/(tabs)/sessions" />

      <View style={st.container}>
        {!!err && <Banner type="error" text={String(err)} />}

        {!session ? (
          <View style={st.center}>
            {sQ.isLoading ? <ActivityIndicator /> : null}
            <Text style={st.helper}>{sQ.isLoading ? "Učitavam…" : "Nije pronađeno."}</Text>
          </View>
        ) : (
          <>
            <View style={st.heroCard}>
              {!!cleanDescription((session as any).note) && <Text style={st.sub}>{cleanDescription((session as any).note)}</Text>}

              <View style={st.metaLine}>
                <View style={[st.badge, badgeStyle((session as any).status)]}>
                  <Text style={st.badgeText}>{statusHr((session as any).status)}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FontAwesome name="home" size={14} color={Colors.sub} />
                  <Text style={st.sub}>Skladište #{(session as any).warehouseId}</Text>
                </View>
              </View>

              {(session as any).status === "DRAFT" ? (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable style={st.primaryPill} onPress={openPartnerPicker}>
                    <Text style={st.primaryPillText}>+ Dodaj partnera</Text>
                  </Pressable>

                  <Pressable style={[st.ghostPill, finalizeM.isPending && { opacity: 0.7 }]} onPress={finalize} disabled={finalizeM.isPending}>
                    <Text style={st.ghostPillText}>{finalizeM.isPending ? "…" : "Finaliziraj"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <FlatList
              data={((session as any).entries ?? []) as BookingSessionEntryResponseDTO[]}
              keyExtractor={(x) => String((x as any).id)}
              contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
              ListEmptyComponent={<Text style={st.helper}>Nema unosa.</Text>}
              renderItem={({ item }) => {
                const pid = Number((item as any).partnerId);
                const dm = (item as any).draftMode;

                return (
                  <View style={st.card}>
                    <View style={st.cardTop}>
                      <Text style={st.title} numberOfLines={1}>
                        {partnerLabel(pid)}
                      </Text>

                      <View style={[st.badge, badgeStyle(dm === "FINAL" ? "FINALIZED" : "DRAFT")]}>
                        <Text style={st.badgeText}>{dm === "FINAL" ? "FINAL" : "DRAFT"}</Text>
                      </View>
                    </View>

                    <View style={st.rowBtns}>
                      <Pressable
                        style={[st.primaryPill, (session as any).status !== "DRAFT" && { opacity: 0.5 }]}
                        disabled={(session as any).status !== "DRAFT"}
                        onPress={() => openEntry(pid)}
                      >
                        <Text style={st.primaryPillText}>Otvori</Text>
                      </Pressable>

                      <Pressable
                        style={[st.dangerPill, (session as any).status !== "DRAFT" && { opacity: 0.5 }]}
                        disabled={(session as any).status !== "DRAFT" || delEntryM.isPending}
                        onPress={() => askDelete(pid)}
                      >
                        <Text style={st.dangerPillText}>{delEntryM.isPending ? "…" : "Obriši"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          </>
        )}
      </View>

      <CenterConfirmSheet
        visible={deleteOpen}
        title="Obrisati unos?"
        description={deleteLbl}
        confirmText="Obriši"
        danger
        loading={delEntryM.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteEntry}
        closeOnBackdrop={!delEntryM.isPending}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  heroCard: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },

  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "800" },

  metaLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  rowBtns: { flexDirection: "row", gap: 10 },

  primaryPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPillText: { color: "#fff", fontWeight: "900" },

  ghostPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostPillText: { fontWeight: "900", color: Colors.text },

  dangerPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerPillText: { color: Colors.dangerText, fontWeight: "900" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
});
