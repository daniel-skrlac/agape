import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
import { DateRangeSheet } from "@/components/DateRangeSheet";

import { toUserMessage } from "@/app/api/apiClient";
import { toLocalDateString, fmtHrFromIso } from "@/app/utils/dateIso";
import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import type {
  BookingSessionCreateRequestDTO,
  BookingSessionResponseDTO,
} from "@/app/models/generated";
import {
  useBookingSessions,
  useCancelBookingSession,
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

function cleanText(v: unknown) {
  const x = String(v ?? "").trim();
  if (
    x.length >= 2 &&
    ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'")))
  ) {
    return x.slice(1, -1);
  }
  return x;
}

function cleanDescription(v: unknown): string | null {
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

function statusLabel(status: unknown) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "CANCELED";
  return String(status ?? "");
}

function badgeStyle(status: unknown) {
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

function formatDateTimeHr(v: unknown): string | null {
  if (!v) return null;

  const d = new Date(String(v));
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
  const [debouncedQ, setDebouncedQ] = useState("");

  const [dateOpen, setDateOpen] = useState(false);
  const [dateFromIso, setDateFromIso] = useState<string | null>(null);
  const [dateToIso, setDateToIso] = useState<string | null>(null);

  const statusParam = filter === "ALL" ? null : filter;

  const listQ = useBookingSessions({
    status: statusParam,
    q: debouncedQ || undefined,
    dateFrom: dateFromIso || undefined,
    dateTo: dateToIso || undefined,
    size: 20,
  });

  const createM = useCreateBookingSession();
  const cancelM = useCancelBookingSession();
  const deleteM = useDeleteBookingSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingSessionResponseDTO | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingSessionResponseDTO | null>(null);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [suppressTopError, setSuppressTopError] = useState(false);

  const [, setResultPopup] = useState<ResultPopupState>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const resetMutationErrors = useCallback(() => {
    createM.reset();
    cancelM.reset();
    deleteM.reset();
  }, [createM, cancelM, deleteM]);

  const refreshScreen = useCallback(async () => {
    setSuppressTopError(false);
    setScreenError(null);
    resetMutationErrors();
    await Promise.resolve(listQ.refresh?.());
  }, [listQ, resetMutationErrors]);

  const { refreshing, onRefresh } = usePullToRefresh([refreshScreen]);

  const rawTopError =
    screenError ||
    (listQ.error ? toUserMessage(listQ.error, "Greška pri učitavanju evidencija.") : null) ||
    (createM.error ? toUserMessage(createM.error, "Greška pri kreiranju evidencije.") : null) ||
    (cancelM.error ? toUserMessage(cancelM.error, "Greška pri otkazivanju evidencije.") : null) ||
    (deleteM.error ? toUserMessage(deleteM.error, "Greška pri brisanju evidencije.") : null);

  const topError = suppressTopError ? null : rawTopError;

  const retryTopError = useCallback(async () => {
    setSuppressTopError(true);
    setScreenError(null);
    resetMutationErrors();

    try {
      await Promise.resolve(listQ.refresh?.());
    } finally {
      setSuppressTopError(false);
    }
  }, [listQ, resetMutationErrors]);

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
      resetMutationErrors();

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
        message: `Kreirana je evidencija "${cleanText(created?.title) || title.trim()}".`,
      });

      await Promise.resolve(listQ.refresh?.());
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri kreiranju evidencije."));
    }
  };

  const askCancel = (it: BookingSessionResponseDTO) => {
    const st = String((it as any)?.status ?? "");
    if (st !== "DRAFT") {
      setResultPopup({
        visible: true,
        kind: "info",
        title: "Nije moguće otkazati",
        message: "Moguće je otkazati samo draft evidenciju.",
      });
      return;
    }

    setCancelTarget(it);
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;

    try {
      setSuppressTopError(false);
      setScreenError(null);
      resetMutationErrors();

      const id = Number((cancelTarget as any)?.id);
      await cancelM.mutateAsync(id);

      setCancelOpen(false);

      const canceledTitle = cleanText((cancelTarget as any)?.title) || `#${id}`;
      setCancelTarget(null);

      setResultPopup({
        visible: true,
        kind: "success",
        title: "Evidencija otkazana",
        message: `Evidencija "${canceledTitle}" je označena kao canceled.`,
      });

      await Promise.resolve(listQ.refresh?.());
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri otkazivanju evidencije."));
    }
  };

  const askDelete = (it: BookingSessionResponseDTO) => {
    const st = String((it as any)?.status ?? "");
    if (st !== "DRAFT") {
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
      resetMutationErrors();

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

      await Promise.resolve(listQ.refresh?.());
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri brisanju evidencije."));
    }
  };

  const sessions = listQ.data ?? [];

  const stats = useMemo(() => {
    const total = listQ.total || 0;
    const draft = sessions.filter((x: any) => x?.status === "DRAFT").length;
    const fin = sessions.filter((x: any) => x?.status === "FINALIZED").length;
    const canceled = sessions.filter((x: any) => x?.status === "CANCELLED").length;
    return { total, draft, fin, canceled };
  }, [sessions, listQ.total]);

  const isInitialLoading = listQ.isLoading && sessions.length === 0 && !refreshing;
  const dateActive = !!dateFromIso && !!dateToIso;

  const dateLabel = useMemo(() => {
    if (!dateActive) return "Datum";
    return `${fmtHrFromIso(dateFromIso)} → ${fmtHrFromIso(dateToIso)}`;
  }, [dateActive, dateFromIso, dateToIso]);

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
              <Text style={s.h1sub}>{stats.total} ukupno</Text>
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
              <Text style={s.statChipText}>Canceled: {stats.canceled}</Text>
            </View>
          </View>
        </View>

        <View style={s.filterWrap}>
          <View style={s.searchWrap}>
            <FontAwesome name="search" size={14} color={Colors.sub} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Pretraži po nazivu, opisu ili ID-u…"
              placeholderTextColor={Colors.sub}
              style={s.searchInput}
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

          <View style={s.filterRow}>
            <Pressable
              style={[s.filterPill, dateActive && s.filterPillActive]}
              onPress={() => setDateOpen(true)}
            >
              <FontAwesome name="calendar" size={14} color={Colors.text} />
              <Text style={s.filterText} numberOfLines={1}>
                {dateLabel}
              </Text>

              {dateActive ? (
                <Pressable
                  onPressIn={(e) => e.stopPropagation?.()}
                  onPress={() => {
                    setDateFromIso(null);
                    setDateToIso(null);
                  }}
                  hitSlop={10}
                >
                  <FontAwesome name="times-circle" size={16} color={Colors.sub} />
                </Pressable>
              ) : (
                <FontAwesome name="chevron-down" size={12} color={Colors.sub} />
              )}
            </Pressable>
          </View>

          <Segmented<SessionFilter>
            value={filter}
            options={[
              { value: "ALL", label: "Sve" },
              { value: "DRAFT", label: "Draft" },
              { value: "FINALIZED", label: "Final" },
              { value: "CANCELLED", label: "Canceled" },
            ]}
            onChange={(next) => {
              setSuppressTopError(false);
              setScreenError(null);
              resetMutationErrors();
              setFilter(next);
            }}
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
            data={sessions}
            keyExtractor={(x) => String((x as any)?.id)}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (!sessions.length) return;
              if (listQ.loadingMore || !listQ.canLoadMore || refreshing) return;
              void listQ.loadMore();
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

              const canMutate = status === "DRAFT";
              const av = initials(t || `#${id}`);

              const anyBusy =
                createM.isPending || cancelM.isPending || deleteM.isPending || refreshing;

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
                      <Text style={s.badgeText}>{statusLabel(status)}</Text>
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
                      <FontAwesome name="folder-open" size={13} color="#fff" />
                      <Text style={s.primaryBtnText}>Otvori</Text>
                    </Pressable>

                    <Pressable
                      style={[s.cancelActionBtn, (!canMutate || anyBusy) && s.disabled]}
                      onPress={() => askCancel(item)}
                      disabled={!canMutate || anyBusy}
                    >
                      <FontAwesome name="ban" size={13} color={Colors.text} />
                      <Text style={s.cancelActionBtnText}>
                        {canMutate ? "Otkaži" : "Zaključ."}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[s.dangerBtn, (!canMutate || anyBusy) && s.disabled]}
                      onPress={() => askDelete(item)}
                      disabled={!canMutate || anyBusy}
                    >
                      <FontAwesome name="trash" size={13} color={Colors.dangerText} />
                      <Text style={s.dangerBtnText}>
                        {canMutate ? "Obriši" : "Zaključ."}
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
                    : dateActive
                      ? "Nema evidencija za odabrani period."
                      : "Kreiraj novu evidenciju za početak."}
                </Text>

                {!q.trim() && !dateActive && (
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
        visible={cancelOpen}
        title="Otkaži evidenciju?"
        description={cancelTarget ? cleanText((cancelTarget as any)?.title) : ""}
        confirmText="Otkaži"
        loading={cancelM.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        closeOnBackdrop={!cancelM.isPending}
      />

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

      <DateRangeSheet
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        valueFromIso={dateFromIso}
        valueToIso={dateToIso}
        onApplyIso={(fromIso, toIso) => {
          setDateFromIso(fromIso);
          setDateToIso(toIso);
        }}
      />
    </Screen>
  );
}