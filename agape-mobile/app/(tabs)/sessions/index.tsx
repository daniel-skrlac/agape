import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { CenterSheet } from "@/components/CenterSheet";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import { Segmented } from "@/components/Segmented";
import InfoResultPopup from "@/components/InfoResultPopup";

import { toUserMessage } from "@/app/api/apiClient";
import { toLocalDateString } from "@/app/utils/dateIso";
import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import type {
  BookingSessionCreateRequestDTO,
  BookingSessionResponseDTO,
} from "@/app/models/generated";
import {
  useBookingSessions,
  useCreateBookingSession,
  useDeleteBookingSession,
} from "@/app/api/hooks/sessions/useBookingSessions";

import { clearDraftsForSession } from "./_entryDraftStore";
import { MAX_W, s } from "./styles/SessionsIndex.styles";

type SessionFilter = "ALL" | "DRAFT" | "FINALIZED" | "CANCELLED";

type ResultPopupState = {
  visible: boolean;
  kind: "success" | "error" | "info";
  title: string;
  message: string;
};

function cleanText(v: any) {
  const x = String(v ?? "").trim();
  if (
    x.length >= 2 &&
    ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'")))
  ) {
    return x.slice(1, -1);
  }
  return x;
}

function cleanDescription(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 0) return null;

  const x = cleanText(v).trim();
  if (!x) return null;
  if (x.replace(/\s/g, "") === "[]") return null;

  return x;
}

function initials(title: string) {
  const t = cleanText(title);
  if (!t) return "E";

  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "E";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return (a + b).toUpperCase();
}

function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

function badgeStyle(status: any) {
  if (status === "FINALIZED") {
    return {
      backgroundColor: "rgba(34,197,94,0.16)",
      borderColor: "rgba(34,197,94,0.34)",
    };
  }

  if (status === "CANCELLED") {
    return {
      backgroundColor: "rgba(239,68,68,0.14)",
      borderColor: "rgba(239,68,68,0.34)",
    };
  }

  return {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderColor: "rgba(249,115,22,0.35)",
  };
}

function formatDateTimeHr(v: any): string | null {
  if (!v) return null;

  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function SessionsIndex() {
  const { session } = useCurrentUser();
  const warehouseId =
    session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const [filter, setFilter] = useState<SessionFilter>("ALL");
  const [q, setQ] = useState("");

  const statusParam = filter === "ALL" ? null : filter;
  const listQ = useBookingSessions(statusParam, { size: 20 });

  const createM = useCreateBookingSession();
  const deleteM = useDeleteBookingSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingSessionResponseDTO | null>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [suppressTopError, setSuppressTopError] = useState(false);

  const [resultPopup, setResultPopup] = useState<ResultPopupState>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

  const rawTopError =
    screenError ||
    (listQ.error ? toUserMessage(listQ.error, "Greška pri učitavanju evidencija.") : null) ||
    (createM.error ? toUserMessage(createM.error, "Greška pri kreiranju evidencije.") : null) ||
    (deleteM.error ? toUserMessage(deleteM.error, "Greška pri brisanju evidencije.") : null);

  const topError = suppressTopError ? null : rawTopError;

  const retryTopError = async () => {
    setSuppressTopError(true);
    setScreenError(null);
    createM.reset();
    deleteM.reset();

    try {
      await listQ.refetch();
    } finally {
      setSuppressTopError(false);
    }
  };

  const openCreate = () => {
    setTitle("");
    setNote("");
    setCreateOpen(true);
  };

  const canCreate = useMemo(() => {
    return !!warehouseId && title.trim().length > 0 && !createM.isPending;
  }, [warehouseId, title, createM.isPending]);

  const handleCreate = async () => {
    if (!warehouseId) {
      setResultPopup({
        visible: true,
        kind: "error",
        title: "Nedostaje skladište",
        message: "U postavkama odaberi glavno skladište prije kreiranja evidencije.",
      });
      return;
    }

    try {
      setSuppressTopError(false);
      setScreenError(null);

      const payload: BookingSessionCreateRequestDTO = {
        title: title.trim(),
        note: note.trim() || null,
        warehouseId,
        documentDate: toLocalDateString(new Date()) as any,
      } as any;

      const created = await createM.mutateAsync(payload);

      setCreateOpen(false);

      setResultPopup({
        visible: true,
        kind: "success",
        title: "Evidencija kreirana",
        message: `Kreirana je evidencija "${cleanText((created as any)?.title) || title.trim()}".`,
      });
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri kreiranju evidencije."));
    }
  };

  const askDelete = (it: BookingSessionResponseDTO) => {
    const status = String((it as any)?.status ?? "");
    if (status !== "DRAFT") {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Nije moguće obrisati",
        message: "Moguće je obrisati samo draft evidenciju.",
      });
      return;
    }

    setDeleteTarget(it);
    setDeleteOpen(true);
  };

  const remove = async () => {
    if (!deleteTarget) return;

    try {
      setSuppressTopError(false);
      setScreenError(null);

      const id = Number((deleteTarget as any)?.id);
      clearDraftsForSession(id);

      await deleteM.mutateAsync(id);

      setDeleteOpen(false);

      const deletedTitle = cleanText((deleteTarget as any)?.title) || `#${id}`;
      setDeleteTarget(null);

      setResultPopup({
        visible: true,
        kind: "success",
        title: "Evidencija obrisana",
        message: `Obrisana je evidencija "${deletedTitle}".`,
      });
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri brisanju evidencije."));
    }
  };

  const sessions = (listQ.data ?? []) as BookingSessionResponseDTO[];

  const filteredSessions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sessions;

    return sessions.filter((x: any) => {
      const t = cleanText(x?.title).toLowerCase();
      const n = cleanDescription(x?.note)?.toLowerCase() ?? "";
      const id = String(Number(x?.id ?? 0));
      return t.includes(qq) || n.includes(qq) || id.includes(qq);
    });
  }, [sessions, q]);

  const stats = useMemo(() => {
    const total = listQ.total || 0;
    const draft = sessions.filter((x: any) => x.status === "DRAFT").length;
    const fin = sessions.filter((x: any) => x.status === "FINALIZED").length;
    const storno = sessions.filter((x: any) => x.status === "CANCELLED").length;
    return { total, draft, fin, storno };
  }, [sessions, listQ.total]);

  const isInitialLoading = listQ.isLoading && sessions.length === 0;

  return (
    <Screen style={s.screen} edges={["left", "right"]}>
      <View style={s.container}>
        {!!topError && (
          <View style={s.topErrorWrap}>
            <ErrorCard
              title="Greška"
              message={topError}
              actionText="Pokušaj ponovno"
              onAction={retryTopError}
              titleLines={1}
              messageLines={3}
            />
          </View>
        )}

        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.heroTitleWrap}>
              <Text style={s.h1}>Evidencije</Text>
              <Text style={s.h1sub}>
                {stats.total} ukupno • učitano {sessions.length}
              </Text>
            </View>

            <Pressable style={s.addBtn} onPress={openCreate} hitSlop={10}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={s.addBtnText}>Nova</Text>
            </Pressable>
          </View>

          <View style={s.statsRow}>
            <View style={s.statChip}>
              <FontAwesome name="clock-o" size={14} color={Colors.sub} />
              <Text style={s.statChipText}>Draft: {stats.draft}</Text>
            </View>

            <View style={s.statChip}>
              <FontAwesome name="check" size={14} color={Colors.sub} />
              <Text style={s.statChipText}>Final: {stats.fin}</Text>
            </View>

            <View style={s.statChip}>
              <FontAwesome name="ban" size={14} color={Colors.sub} />
              <Text style={s.statChipText}>Storno: {stats.storno}</Text>
            </View>
          </View>
        </View>

        <View style={s.filterWrap}>
          <Segmented<SessionFilter>
            value={filter}
            options={[
              { value: "ALL", label: "Sve" },
              { value: "DRAFT", label: "Draft" },
              { value: "FINALIZED", label: "Final" },
              { value: "CANCELLED", label: "Storno" },
            ]}
            onChange={(next) => {
              setSuppressTopError(false);
              setScreenError(null);
              setFilter(next);
            }}
          />

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pretraži po nazivu, opisu ili ID-u…"
            placeholderTextColor={Colors.sub}
            style={s.search}
            autoCorrect={false}
          />
        </View>

        {isInitialLoading ? (
          <View style={s.center}>
            <ActivityIndicator />
            <Text style={s.helper}>Učitavam evidencije…</Text>
          </View>
        ) : (
          <FlatList
            style={s.list}
            data={filteredSessions}
            keyExtractor={(x) => String((x as any)?.id)}
            refreshing={listQ.refreshing}
            onRefresh={async () => {
              setSuppressTopError(false);
              setScreenError(null);
              createM.reset();
              deleteM.reset();
              await listQ.refresh();
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.listContent}
            renderItem={({ item }) => {
              const id = Number((item as any)?.id);
              const status = (item as any)?.status;
              const t = cleanText((item as any)?.title);
              const n = cleanDescription((item as any)?.note);
              const updatedAt =
                formatDateTimeHr((item as any)?.updatedAt) ||
                formatDateTimeHr((item as any)?.dateModified);
              const createdAt =
                formatDateTimeHr((item as any)?.createdAt) ||
                formatDateTimeHr((item as any)?.dateCreated);

              const canDelete = status === "DRAFT";
              const av = initials(t || `#${id}`);

              const open = () =>
                router.push({
                  pathname: "/(tabs)/sessions/[id]" as const,
                  params: { id: String(id) },
                });

              return (
                <Pressable style={s.card} onPress={open}>
                  <View style={s.cardTop}>
                    <View style={s.left}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{av}</Text>
                      </View>

                      <View style={s.titleWrap}>
                        <Text style={s.title} numberOfLines={1}>
                          {t || "—"}
                        </Text>
                        <Text style={s.sub} numberOfLines={1}>
                          ID #{id} • Skladište #{(item as any)?.warehouseId}
                        </Text>
                      </View>
                    </View>

                    <View style={[s.badge, badgeStyle(status)]}>
                      <Text style={s.badgeText}>{statusHr(status)}</Text>
                    </View>
                  </View>

                  <View style={s.metaRow}>
                    {!!createdAt && (
                      <View style={s.tinyPill}>
                        <Text style={s.tinyPillText}>Kreirano: {createdAt}</Text>
                      </View>
                    )}

                    {!!updatedAt && (
                      <View style={s.tinyPill}>
                        <Text style={s.tinyPillText}>Ažurirano: {updatedAt}</Text>
                      </View>
                    )}
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
                      style={[s.dangerBtn, (!canDelete || deleteM.isPending) && s.disabled]}
                      onPress={() => askDelete(item)}
                      disabled={!canDelete || deleteM.isPending}
                    >
                      <FontAwesome name="trash" size={14} color={Colors.dangerText} />
                      <Text style={s.dangerBtnText}>
                        {canDelete ? (deleteM.isPending ? "…" : "Obriši") : "Zaključano"}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <FontAwesome name="inbox" size={18} color={Colors.sub} />
                <Text style={s.emptyTitle}>Nema evidencija</Text>
                <Text style={s.emptySub}>
                  {q.trim()
                    ? "Nijedna evidencija ne odgovara pretrazi."
                    : "Kreiraj novu evidenciju za početak."}
                </Text>

                {!q.trim() && (
                  <Pressable style={s.addBtn} onPress={openCreate}>
                    <FontAwesome name="plus" size={14} color="#fff" />
                    <Text style={s.addBtnText}>Nova evidencija</Text>
                  </Pressable>
                )}
              </View>
            }
            ListFooterComponent={
              listQ.loadingMore || listQ.canLoadMore || listQ.loadMoreError ? (
                <View style={s.loadMoreWrap}>
                  {listQ.loadingMore ? <ActivityIndicator size="small" /> : null}

                  {listQ.loadMoreError ? (
                    <Pressable
                      style={s.loadMoreBtn}
                      onPress={() => {
                        void listQ.loadMore();
                      }}
                    >
                      <Text style={s.loadMoreText}>Greška • Dodirni za pokušaj ponovno</Text>
                    </Pressable>
                  ) : null}

                  {!listQ.loadingMore && listQ.canLoadMore && !listQ.loadMoreError ? (
                    <Pressable
                      style={s.loadMoreBtn}
                      onPress={() => {
                        void listQ.loadMore();
                      }}
                    >
                      <Text style={s.loadMoreText}>Učitaj još</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null
            }
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
          {!warehouseId && (
            <ErrorCard
              title="Nedostaje glavno skladište"
              message="U postavkama odaberi glavno skladište prije kreiranja evidencije."
              actionText="Zatvori"
              onAction={() => setCreateOpen(false)}
              titleLines={2}
              messageLines={3}
            />
          )}

          <Text style={s.label}>Naziv</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={s.input}
            placeholder="npr. Utorak 10.02."
            placeholderTextColor={Colors.sub}
            autoCorrect={false}
            editable={!createM.isPending}
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
            editable={!createM.isPending}
          />

          <Pressable
            style={[s.createBtn, !canCreate && s.disabled]}
            disabled={!canCreate}
            onPress={handleCreate}
          >
            {createM.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text style={s.createBtnText}>Kreiraj</Text>
            )}
          </Pressable>

          <Pressable
            style={[s.cancelBtn, createM.isPending && s.disabled]}
            disabled={createM.isPending}
            onPress={() => setCreateOpen(false)}
          >
            <Text style={s.cancelBtnText}>Odustani</Text>
          </Pressable>
        </View>
      </CenterSheet>

      <CenterConfirmSheet
        visible={deleteOpen}
        title="Obrisati evidenciju?"
        description={deleteTarget ? cleanText((deleteTarget as any)?.title) : ""}
        confirmText="Obriši"
        danger
        loading={deleteM.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        closeOnBackdrop={!deleteM.isPending}
      />

      <InfoResultPopup
        visible={resultPopup.visible}
        variant={resultPopup.kind}
        title={resultPopup.title}
        message={resultPopup.message}
        buttonText="U redu"
        onClose={() => setResultPopup((prev) => ({ ...prev, visible: false }))}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}