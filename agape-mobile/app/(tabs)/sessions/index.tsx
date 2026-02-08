import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { CenterSheet } from "@/components/CenterSheet";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import type { BookingSessionCreateRequestDTO, BookingSessionResponseDTO } from "@/app/models/generated";
import { useBookingSessions, useCreateBookingSession, useDeleteBookingSession } from "@/app/api/hooks/useBookingSessions";

const MAX_W = 560;

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

function Header({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={s.header}>
      <Text style={s.headerTitle}>Evidencije</Text>

      <Pressable style={s.addBtn} onPress={onAdd} hitSlop={8}>
        <Text style={s.addBtnText}>+ Dodaj</Text>
      </Pressable>
    </View>
  );
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

  const canCreate = useMemo(() => {
    return !!warehouseId && title.trim().length > 0 && !createM.isPending;
  }, [warehouseId, title, createM.isPending]);

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

    const created = await createM.mutateAsync(payload);
    setCreateOpen(false);
    router.push(`/(tabs)/sessions/${created.id}`);
  };

  const remove = async (id: number) => {
    await deleteM.mutateAsync(id);
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

        <Header onAdd={openCreate} />

        {listQ.isLoading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.helper}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            data={(listQ.data ?? []) as BookingSessionResponseDTO[]}
            keyExtractor={(x) => String(x.id)}
            contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
            ListEmptyComponent={<Text style={s.helper}>Nema evidencija.</Text>}
            renderItem={({ item }) => (
              <Pressable style={s.card} onPress={() => router.push(`/(tabs)/sessions/${item.id}`)}>
                <View style={s.cardTop}>
                  <Text style={s.title} numberOfLines={1}>
                    {item.title}
                  </Text>

                  <View style={[s.badge, badgeStyle(item.status)]}>
                    <Text style={s.badgeText}>{statusHr(item.status)}</Text>
                  </View>
                </View>

                {!!item.note && (
                  <Text style={s.sub} numberOfLines={2}>
                    {item.note}
                  </Text>
                )}

                <View style={s.metaRow}>
                  <FontAwesome name="home" size={14} color={Colors.sub} />
                  <Text style={s.sub}>Skladište #{item.warehouseId}</Text>
                </View>

                <View style={s.rowBtns}>
                  <Pressable style={s.smallBtn} onPress={() => router.push(`/(tabs)/sessions/${item.id}`)}>
                    <Text style={s.smallBtnText}>Otvori</Text>
                  </Pressable>

                  <Pressable
                    style={[s.smallBtn, { backgroundColor: Colors.dangerBg }]}
                    onPress={() => remove(Number(item.id))}
                    disabled={deleteM.isPending}
                  >
                    <Text style={[s.smallBtnText, { color: Colors.dangerText }]}>
                      {deleteM.isPending ? "…" : "Obriši"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Create popup (CenterSheet) */}
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
            placeholder="npr. Jutarnja otprema"
            placeholderTextColor={Colors.sub}
            autoCorrect={false}
          />

          <Text style={s.label}>Napomena (opcionalno)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={[s.input, { minHeight: 96 }]}
            multiline
            placeholder="…"
            placeholderTextColor={Colors.sub}
            textAlignVertical="top"
            autoCorrect={false}
          />

          <Pressable style={[s.primaryBtn, !canCreate && { opacity: 0.5 }]} disabled={!canCreate} onPress={create}>
            {createM.isPending ? <ActivityIndicator /> : <Text style={s.primaryText}>Kreiraj</Text>}
          </Pressable>

          <Pressable
            style={[s.secondaryBtn, createM.isPending && { opacity: 0.5 }]}
            disabled={createM.isPending}
            onPress={() => setCreateOpen(false)}
          >
            <Text style={s.secondaryText}>Odustani</Text>
          </Pressable>
        </View>
      </CenterSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  headerTitle: { fontWeight: "900", color: Colors.text, fontSize: 24, letterSpacing: -0.2 },

  // “Dodaj” kao template feel (pill)
  addBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

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

  label: { fontWeight: "900", color: Colors.text },

  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },

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
