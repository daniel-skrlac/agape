// app/(tabs)/sessions/index.tsx
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";

import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import type { BookingSessionCreateRequestDTO, BookingSessionResponseDTO } from "@/app/models/generated";
import { useBookingSessions, useCreateBookingSession, useDeleteBookingSession } from "@/app/api/hooks/useBookingSessions";

// ✅ NEW
import { clearDraftsForSession } from "./_entryDraftStore";

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
  if (status === "FINALIZED") return { backgroundColor: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.34)" };
  if (status === "CANCELLED") return { backgroundColor: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.34)" };
  return { backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.35)" };
}
function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

function initials(title: string) {
  const t = cleanText(title);
  if (!t) return "E";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "E";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
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

  const err = (listQ.error as any)?.message || (createM.error as any)?.message || (deleteM.error as any)?.message || null;

  const canCreate = useMemo(() => !!warehouseId && title.trim().length > 0 && !createM.isPending, [warehouseId, title, createM.isPending]);

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

    const id = Number((deleteTarget as any).id);

    // ✅ HARD FIX: clear local drafts for this session so nothing "ghost" remains
    clearDraftsForSession(id);

    await deleteM.mutateAsync(id);

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

  const sessions = (listQ.data ?? []) as BookingSessionResponseDTO[];

  const stats = useMemo(() => {
    const total = sessions.length;
    const draft = sessions.filter((x: any) => x.status === "DRAFT").length;
    const fin = sessions.filter((x: any) => x.status === "FINALIZED").length;
    const storno = sessions.filter((x: any) => x.status === "CANCELLED").length;
    return { total, draft, fin, storno };
  }, [sessions]);

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <View style={s.container}>
        {!!err && <Banner type="error" text={String(err)} />}

        {/* TOP */}
        <View style={s.topHeader}>
          <View style={{ gap: 2 }}>
            <Text style={s.h1}>Evidencije</Text>
            <Text style={s.h1sub}>
              {stats.total} ukupno • {stats.draft} draft • {stats.fin} final • {stats.storno} storno
            </Text>
          </View>

          <Pressable style={s.addBtn} onPress={openCreate} hitSlop={10}>
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={s.addBtnText}>Nova</Text>
          </Pressable>
        </View>

        {/* SUMMARY STRIP */}
        <View style={s.summaryStrip}>
          <View style={s.summaryChip}>
            <FontAwesome name="clock-o" size={14} color={Colors.sub} />
            <Text style={s.summaryText}>Aktivne: {stats.draft}</Text>
          </View>

          <View style={s.summaryChip}>
            <FontAwesome name="check" size={14} color={Colors.sub} />
            <Text style={s.summaryText}>Final: {stats.fin}</Text>
          </View>
        </View>

        {listQ.isLoading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.helper}>Učitavam…</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(x) => String((x as any).id)}
            contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <FontAwesome name="inbox" size={18} color={Colors.sub} />
                <Text style={s.helper}>Nema sesija.</Text>
                <Pressable style={[s.addBtn, { marginTop: 10 }]} onPress={openCreate}>
                  <FontAwesome name="plus" size={14} color="#fff" />
                  <Text style={s.addBtnText}>Nova evidencija</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => {
              const id = Number((item as any).id);
              const t = cleanText((item as any).title);
              const n = cleanDescription((item as any).note);

              const open = () =>
                router.push({
                  pathname: "/(tabs)/sessions/[id]" as const,
                  params: { id: String(id) },
                });

              const av = initials(t || `#${id}`);

              return (
                <Pressable style={s.card} onPress={open}>
                  <View style={s.cardTop}>
                    <View style={s.left}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{av}</Text>
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.title} numberOfLines={1}>
                          {t || "—"}
                        </Text>
                        <Text style={s.sub} numberOfLines={1}>
                          ID #{id} • Skladište #{(item as any).warehouseId}
                        </Text>
                      </View>
                    </View>

                    <View style={[s.badge, badgeStyle((item as any).status)]}>
                      <Text style={s.badgeText}>{statusHr((item as any).status)}</Text>
                    </View>
                  </View>

                  {!!n && (
                    <View style={s.noteBox}>
                      <FontAwesome name="sticky-note" size={14} color={Colors.sub} />
                      <Text style={s.noteText} numberOfLines={2}>
                        {n}
                      </Text>
                    </View>
                  )}

                  <View style={s.rowBtns}>
                    <Pressable style={s.primaryBtn} onPress={open}>
                      <FontAwesome name="folder-open" size={14} color="#fff" />
                      <Text style={s.primaryBtnText}>Otvori</Text>
                    </Pressable>

                    <Pressable
                      style={[s.dangerBtn, deleteM.isPending && { opacity: 0.7 }]}
                      onPress={() => askDelete(item)}
                      disabled={deleteM.isPending}
                    >
                      <FontAwesome name="trash" size={14} color={Colors.dangerText} />
                      <Text style={s.dangerBtnText}>{deleteM.isPending ? "…" : "Obriši"}</Text>
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
            placeholder="npr. Dogovoreni jutarnji odvoz"
            placeholderTextColor={Colors.sub}
            textAlignVertical="top"
            autoCorrect={false}
          />

          <Pressable style={[s.createBtn, !canCreate && { opacity: 0.5 }]} disabled={!canCreate} onPress={create}>
            {createM.isPending ? <ActivityIndicator /> : <Text style={s.createBtnText}>Kreiraj</Text>}
          </Pressable>

          <Pressable style={[s.cancelBtn, createM.isPending && { opacity: 0.6 }]} disabled={createM.isPending} onPress={() => setCreateOpen(false)}>
            <Text style={s.cancelBtnText}>Odustani</Text>
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

  topHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontWeight: "900", color: Colors.text, fontSize: 22 },
  h1sub: { color: Colors.sub, fontWeight: "800" },

  addBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  summaryStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  summaryText: { color: Colors.sub, fontWeight: "900" },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center", marginTop: 10 },

  emptyBox: {
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.08)",
    alignItems: "center",
    gap: 8,
  },

  card: {
    backgroundColor: Colors.bg,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },

  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "900", color: Colors.text },

  title: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  sub: { color: Colors.sub, fontWeight: "800" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  noteText: { color: Colors.sub, fontWeight: "800", lineHeight: 18, flex: 1 },

  rowBtns: { flexDirection: "row", gap: 10 },

  primaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  dangerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  dangerBtnText: { color: Colors.dangerText, fontWeight: "900" },

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

  createBtn: { paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center", justifyContent: "center" },
  createBtnText: { color: "#fff", fontWeight: "900" },

  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.20)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontWeight: "900", color: Colors.text },
});
