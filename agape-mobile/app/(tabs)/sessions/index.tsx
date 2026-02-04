import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { Sheet } from "@/components/Sheet";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import type { BookingSessionCreateRequestDTO, BookingSessionResponseDTO } from "@/app/models/generated";

import {
  useBookingSessions,
  useCreateBookingSession,
  useDeleteBookingSession,
} from "@/app/api/hooks/useBookingSessions";

function badgeStyle(status: any) {
  if (status === "FINALIZED")
    return { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.35)" };
  if (status === "CANCELLED")
    return { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.35)" };
  return { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" };
}

export default function SessionsIndex() {
  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const listQ = useBookingSessions();
  const createM = useCreateBookingSession();
  const deleteM = useDeleteBookingSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const err = (listQ.error as any)?.message || (createM.error as any)?.message || (deleteM.error as any)?.message || null;

  const canCreate = useMemo(() => !!warehouseId && title.trim().length > 0 && !createM.isPending, [warehouseId, title, createM.isPending]);

  if (ready && !warehouseId) {
    return (
      <Screen>
        <View style={{ padding: 14, gap: 12 }}>
          <Banner type="error" text="Nema odabranog glavnog skladišta. U Postavkama prvo odaberi glavno skladište." />
        </View>
      </Screen>
    );
  }

  const create = async () => {
    if (!warehouseId) return;
    const payload: BookingSessionCreateRequestDTO = {
      title: title.trim(),
      note: note.trim() || null,
      warehouseId,
      documentDate: new Date() as any,
    } as any;

    const s = await createM.mutateAsync(payload);
    setCreateOpen(false);
    setTitle("");
    setNote("");
    router.push(`/(tabs)/sessions/${s.id}`);
  };

  const remove = async (id: number) => {
    await deleteM.mutateAsync(id);
  };

  return (
    <Screen>
      <View style={s.container}>
        {!!err && <Banner type="error" text={err} />}

        <View style={s.headerRow}>
          <Text style={s.h1}>Sessions</Text>
          <Pressable style={s.primary} onPress={() => setCreateOpen(true)}>
            <Text style={s.primaryText}>+ New</Text>
          </Pressable>
        </View>

        <FlatList
          data={(listQ.data ?? []) as BookingSessionResponseDTO[]}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => router.push(`/(tabs)/sessions/${item.id}`)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <Text style={s.title} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={[s.badge, badgeStyle(item.status)]}>
                  <Text style={s.badgeText}>{item.status}</Text>
                </View>
              </View>

              {!!item.note && (
                <Text style={s.sub} numberOfLines={2}>
                  {item.note}
                </Text>
              )}

              <Text style={s.sub}>Warehouse #{item.warehouseId}</Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Pressable style={s.smallBtn} onPress={() => router.push(`/(tabs)/sessions/${item.id}`)}>
                  <Text style={s.smallBtnText}>Open</Text>
                </Pressable>

                <Pressable
                  style={[s.smallBtn, { backgroundColor: Colors.dangerBg }]}
                  onPress={() => remove(Number(item.id))}
                  disabled={deleteM.isPending}
                >
                  <Text style={[s.smallBtnText, { color: Colors.dangerText }]}>
                    {deleteM.isPending ? "…" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            listQ.isLoading ? <Text style={s.helper}>Loading…</Text> : <Text style={s.helper}>No sessions.</Text>
          }
        />

        <Sheet visible={createOpen} title="New session" onClose={() => setCreateOpen(false)}>
          <View style={{ gap: 10 }}>
            <Text style={s.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={s.input}
              placeholder="npr. Jutarnja otprema"
              placeholderTextColor={Colors.sub}
            />

            <Text style={s.label}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={[s.input, { minHeight: 90 }]}
              multiline
              placeholder="…"
              placeholderTextColor={Colors.sub}
            />

            <Pressable style={[s.primary, !canCreate && { opacity: 0.5 }]} disabled={!canCreate} onPress={create}>
              <Text style={s.primaryText}>Create</Text>
            </Pressable>
          </View>
        </Sheet>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontWeight: "900", color: Colors.text, fontSize: 18 },

  label: { fontWeight: "900", color: Colors.text },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 20 },

  primary: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.orange },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 15, flex: 1 },
  sub: { color: Colors.sub, fontWeight: "800" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  smallBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
  },
  smallBtnText: { fontWeight: "900", color: Colors.text },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontWeight: "800",
    backgroundColor: Colors.bg,
  },
});
