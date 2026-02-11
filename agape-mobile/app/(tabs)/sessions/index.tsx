import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import type { BookingSessionCreateRequestDTO, BookingSessionResponseDTO } from "@/app/models/generated";
import { useBookingSessions, useCreateBookingSession, useDeleteBookingSession } from "@/app/api/hooks/useBookingSessions";

const MAX_W = 560;

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

export default function SessionsIndex() {
  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const listQ = useBookingSessions(null);
  const createM = useCreateBookingSession();
  const deleteM = useDeleteBookingSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingSessionResponseDTO | null>(null);

  const err =
    (listQ.error as any)?.message ||
    (createM.error as any)?.message ||
    (deleteM.error as any)?.message ||
    null;

  const canCreate = useMemo(
    () => !!warehouseId && title.trim().length > 0 && !createM.isPending,
    [warehouseId, title, createM.isPending]
  );

  const openCreate = () => {
    setTitle("");
    setNote("");
    setCreateOpen(true);
  };

  const create = async () => {
    if (!warehouseId) return;

    const payload: BookingSessionCreateRequestDTO = {
      title: title.trim(),
      note: note.trim() || null,
      warehouseId,
      documentDate: new Date() as any,
    } as any;

    await createM.mutateAsync(payload);

    setCreateOpen(false);
    listQ.refetch?.();
  };

  const askDelete = (it: BookingSessionResponseDTO) => {
    setDeleteTarget(it);
    setDeleteOpen(true);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await deleteM.mutateAsync(Number((deleteTarget as any).id));
    setDeleteOpen(false);
    setDeleteTarget(null);
    listQ.refetch?.();
  };

  if (ready && !warehouseId) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <View style={{ padding: 14, gap: 12 }}>
          <Banner type="error" text="Nema odabranog glavnog skladišta. U Postavkama prvo odaberi glavno skladište." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <View style={s.container}>
        {!!err && <Banner type="error" text={String(err)} />}

        <View style={s.topRow}>
          <View style={{ flex: 1 }} />
          <Pressable style={s.addPill} onPress={openCreate} hitSlop={10}>
            <Text style={s.addPillText}>+ Dodaj</Text>
          </Pressable>
        </View>

        {listQ.isLoading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.helper}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            data={(listQ.data ?? []) as BookingSessionResponseDTO[]}
            keyExtractor={(x) => String((x as any).id)}
            contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
            ListEmptyComponent={<Text style={s.helper}>Nema sesija.</Text>}
            renderItem={({ item }) => {
              const id = Number((item as any).id);
              const t = cleanText((item as any).title);
              const n = cleanDescription((item as any).note);

              const open = () =>
                router.push({
                  pathname: "/(tabs)/sessions/[id]" as const,
                  params: { id: String(id) },
                });

              return (
                <Pressable style={s.card} onPress={open}>
                  <View style={s.cardTop}>
                    <Text style={s.title} numberOfLines={1}>
                      {t || "—"}
                    </Text>

                    <View style={[s.badge, badgeStyle((item as any).status)]}>
                      <Text style={s.badgeText}>{statusHr((item as any).status)}</Text>
                    </View>
                  </View>

                  {!!n && (
                    <Text style={s.sub} numberOfLines={2}>
                      {n}
                    </Text>
                  )}

                  <View style={s.metaRow}>
                    <Text style={s.sub}>Skladište #{(item as any).warehouseId}</Text>
                  </View>

                  <View style={s.rowBtns}>
                    <Pressable style={s.primaryPill} onPress={open}>
                      <Text style={s.primaryPillText}>Otvori</Text>
                    </Pressable>

                    <Pressable
                      style={[s.dangerPill, deleteM.isPending && { opacity: 0.7 }]}
                      onPress={() => askDelete(item)}
                      disabled={deleteM.isPending}
                    >
                      <Text style={s.dangerPillText}>{deleteM.isPending ? "…" : "Obriši"}</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <CenterSheet
        visible={createOpen}
        title="Nova evidencija"
        width={MAX_W}
        closeOnBackdrop={false}
        disableClose={createM.isPending}
        onClose={() => {
          if (createM.isPending) return;
          setCreateOpen(false);
        }}
      >
        <View style={{ gap: 10 }}>
          <Text style={s.label}>Naziv</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={s.input}
            placeholder="npr. Utorak 10.02."
            placeholderTextColor={Colors.sub}
            autoCorrect={false}
          />

          <Text style={s.label}>Opis (opcionalno)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={[s.input, { minHeight: 96 }]}
            multiline
            placeholder=""
            placeholderTextColor={Colors.sub}
            textAlignVertical="top"
            autoCorrect={false}
          />

          <Pressable style={[s.primaryBtn, !canCreate && { opacity: 0.5 }]} disabled={!canCreate} onPress={create}>
            {createM.isPending ? <ActivityIndicator /> : <Text style={s.primaryText}>Kreiraj</Text>}
          </Pressable>

          <Pressable
            style={[s.ghostBtn, createM.isPending && { opacity: 0.6 }]}
            disabled={createM.isPending}
            onPress={() => setCreateOpen(false)}
          >
            <Text style={s.ghostText}>Odustani</Text>
          </Pressable>
        </View>
      </CenterSheet>

      <CenterConfirmSheet
        visible={deleteOpen}
        title="Obrisati evidenciju?"
        description={deleteTarget ? cleanText((deleteTarget as any).title) : ""}
        confirmText="Obriši"
        danger
        loading={deleteM.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        closeOnBackdrop={!deleteM.isPending}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  addPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  addPillText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 10 },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  title: { fontWeight: "900", color: Colors.text, fontSize: 16, flex: 1 },
  sub: { color: Colors.sub, fontWeight: "800" },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  rowBtns: { flexDirection: "row", gap: 10, marginTop: 2 },

  primaryPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPillText: { color: "#fff", fontWeight: "900" },

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

  label: { fontWeight: "900", color: Colors.text },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontWeight: "800",
    backgroundColor: "rgba(148,163,184,0.12)",
  },

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
});
