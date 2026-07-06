import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import NavigationHeader from "@/components/NavigationHeader";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import ValidateImpactModal from "@/components/ValidateImpactModal";
import ValidateManyModal, { toValidateRow } from "@/components/ValidateManyModal";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionResponseDTO,
  DraftMode,
  WarehouseBookingImpactDTO,
} from "@/src/models/generated";

import {
  useBookingSession,
  useDeleteBookingSessionEntry,
  useFinalizeBookingSession,
  useValidateBookingSessionFinalization,
} from "../../../../src/api/hooks/sessions/useBookingSessions";
import { usePullToRefresh } from "../../../../src/api/hooks/common/usePullToRefresh";
import { toUserMessage } from "../../../../src/api/apiClient";

import {
  clearDraft,
  clearDraftsForSession,
} from "../../../../src/stores/entryDraftStore";

function cleanText(v: any) {
  const s = String(v ?? "").trim();
  if (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    return s.slice(1, -1);
  }
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

function initials(name: string) {
  const n = cleanText(name);
  if (!n) return "•";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "•";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function statusHr(status: any) {
  if (status === "DRAFT") return "DRAFT";
  if (status === "FINALIZED") return "FINAL";
  if (status === "CANCELLED") return "STORNO";
  return String(status ?? "");
}

function badgeStyle(kind: any): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  if (kind === "FINALIZED" || kind === "FINAL") {
    return {
      backgroundColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.30)",
      textColor: Colors.text,
    };
  }

  if (kind === "CANCELLED" || kind === "ERROR" || kind === "BAD") {
    return {
      backgroundColor: "rgba(239,68,68,0.10)",
      borderColor: "rgba(239,68,68,0.30)",
      textColor: Colors.dangerText,
    };
  }

  if (kind === "WARN") {
    return {
      backgroundColor: "rgba(249,115,22,0.14)",
      borderColor: "rgba(249,115,22,0.30)",
      textColor: Colors.text,
    };
  }

  return {
    backgroundColor: "rgba(249,115,22,0.10)",
    borderColor: "rgba(249,115,22,0.28)",
    textColor: Colors.text,
  };
}

function entryNameHint(entry: any): string | null {
  const candidates = [entry?.partnerName, entry?.partner?.name, entry?.name];
  for (const c of candidates) {
    const s = cleanText(c);
    if (s) return s;
  }
  return null;
}

function entryMode(entry: any): DraftMode {
  return (((entry?.draftMode as any) ||
    (entry?.draft ? ("DRAFT" as any) : ("FINAL" as any)) ||
    ("DRAFT" as any)) as any);
}

type ValidateRow = {
  partnerId: number;
  partnerName: string;
  ok: number;
  warn: number;
  bad: number;
  total: number;
  data: WarehouseBookingImpactDTO | null;
  error: string | null;
  warning: string | null;
};

export default function SessionDetailIndex() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const delEntryM = useDeleteBookingSessionEntry(sessionId);
  const finalizeM = useFinalizeBookingSession(sessionId);
  const validateSessionM = useValidateBookingSessionFinalization(sessionId);

  const [screenError, setScreenError] = useState<string | null>(null);
  const [suppressTopError, setSuppressTopError] = useState(false);

  const resetMutationErrors = useCallback(() => {
    delEntryM.reset();
    finalizeM.reset();
    validateSessionM.reset();
  }, [delEntryM, finalizeM, validateSessionM]);

  const rawTopError =
    screenError ||
    (sQ.error ? toUserMessage(sQ.error, "Greška pri učitavanju evidencije.") : null) ||
    (delEntryM.error ? toUserMessage(delEntryM.error, "Greška pri brisanju unosa.") : null) ||
    (finalizeM.error ? toUserMessage(finalizeM.error, "Greška pri knjiženju sesije.") : null);

  const topError = suppressTopError ? null : rawTopError;

  const retryTopError = useCallback(async () => {
    setSuppressTopError(true);
    setScreenError(null);
    resetMutationErrors();
    try {
      await sQ.refetch();
    } finally {
      setSuppressTopError(false);
    }
  }, [resetMutationErrors, sQ]);

  const onRefreshSession = useCallback(async () => {
    setSuppressTopError(false);
    setScreenError(null);
    resetMutationErrors();
    await sQ.refetch();
  }, [resetMutationErrors, sQ]);

  const { refreshing, onRefresh } = usePullToRefresh([onRefreshSession]);

  const headerTitle = cleanText((session as any)?.title) || "Evidencija";
  const status = (session as any)?.status;
  const warehouseId = Number((session as any)?.warehouseId ?? 0) || null;
  const canEdit = status === "DRAFT";

  const entries = useMemo(
    () => (((session as any)?.entries ?? []) as BookingSessionEntryResponseDTO[]),
    [session]
  );

  const partnerName = useCallback((partnerId: number, entry?: any) => {
    const hint = entryNameHint(entry);
    return hint || (partnerId > 0 ? `Partner #${partnerId}` : "Partner");
  }, []);

  const openPartnerPicker = useCallback(() => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/partner" as const,
      params: { id: String(sessionId) },
    });
  }, [sessionId]);

  const openEntry = useCallback(
    (partnerId: number, partnerNameHint?: string | null) => {
      router.push({
        pathname: "/(tabs)/sessions/[id]/entry" as const,
        params: {
          id: String(sessionId),
          partnerId: String(partnerId),
          partnerName: partnerNameHint?.trim() || undefined,
        },
      });
    },
    [sessionId]
  );

  const openScan = useCallback(() => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/scan" as const,
      params: { id: String(sessionId) },
    });
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    if ((session as any)?.status && (session as any)?.status !== "DRAFT") {
      clearDraftsForSession(sessionId);
    }
  }, [session?.id, (session as any)?.status, sessionId]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePid, setDeletePid] = useState<number | null>(null);
  const [deleteLbl, setDeleteLbl] = useState("");

  const askDelete = useCallback(
    (pid: number, entry?: any) => {
      const nm = partnerName(pid, entry);
      setDeletePid(pid);
      setDeleteLbl(nm);
      setDeleteOpen(true);
    },
    [partnerName]
  );

  const deleteEntry = useCallback(async () => {
    if (!deletePid) return;

    try {
      setSuppressTopError(false);
      setScreenError(null);
      resetMutationErrors();

      await delEntryM.mutateAsync(Number(deletePid));
      clearDraft(sessionId, Number(deletePid));
      setDeleteOpen(false);
      setDeletePid(null);
      await sQ.refetch();
    } catch (e) {
      setScreenError(toUserMessage(e, "Greška pri brisanju unosa."));
    }
  }, [deletePid, delEntryM, sQ, sessionId, resetMutationErrors]);

  const [validateOpen, setValidateOpen] = useState(false);
  const [validateManyOpen, setValidateManyOpen] = useState(false);
  const [validateBusy, setValidateBusy] = useState(false);
  const [validateManyRows, setValidateManyRows] = useState<ValidateRow[]>([]);

  const [validateOneData, setValidateOneData] = useState<WarehouseBookingImpactDTO | null>(null);
  const [validateOneError, setValidateOneError] = useState<string | null>(null);
  const [validateOneWarning, setValidateOneWarning] = useState<string | null>(null);

  const [detailFromMany, setDetailFromMany] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const finalizeBusyRef = useRef(false);
  const validationModalBusy = validateBusy || finalizeBusy || finalizeM.isPending;

  const makeSessionErrorRow = useCallback(
    (message: string): ValidateRow => ({
      partnerId: 0,
      partnerName: "Evidencija",
      data: null,
      error: message,
      warning: null,
      ok: 0,
      warn: 0,
      bad: 0,
      total: 0,
    }),
    []
  );

  const startValidateThenConfirm = useCallback(async () => {
    if (!session || status !== "DRAFT") return;

    setSuppressTopError(false);
    setScreenError(null);
    resetMutationErrors();
    setValidateOpen(false);
    setValidateOneData(null);
    setValidateOneError(null);
    setValidateOneWarning(null);

    if (!entries.length) {
      setDetailFromMany(false);
      setValidateOpen(false);
      setValidateManyRows([makeSessionErrorRow("Nema unosa za knjiženje.")]);
      setValidateManyOpen(true);
      return;
    }

    setDetailFromMany(false);
    setValidateManyOpen(true);
    setValidateManyRows([]);
    setValidateBusy(true);

    try {
      const res = await validateSessionM.mutateAsync();

      const rows: ValidateRow[] = (res.results ?? []).map((row) => {
        const partnerId = Number((row as any).partnerId);
        const entry = entries.find((value: any) => Number(value?.partnerId) === partnerId);
        const data = (row as any).data ?? null;
        const documentId = Number(data?.documentId ?? (row as any)?.documentId ?? 0) || 0;
        const warehouseId = Number(data?.warehouseId ?? (row as any)?.warehouseId ?? 0) || 0;
        const documentCode = String(data?.documentCode ?? (row as any)?.documentCode ?? "").trim();
        const contextSub = [
          documentCode || null,
          documentId ? `Dokument #${documentId}` : null,
          warehouseId ? `Skladište #${warehouseId}` : null,
        ].filter(Boolean).join(" • ");

        return toValidateRow({
          partnerId,
          partnerName: entryNameHint(entry) || `Partner #${partnerId}`,
          contextLabel: documentId ? `Dokument #${documentId}` : null,
          contextSub: contextSub || null,
          data,
          error: (row as any).error ?? null,
          warning: null,
        });
      });

      if (!rows.length) {
        setValidateManyRows([makeSessionErrorRow("Nema valjanih stavki za validaciju.")]);
        setValidateManyOpen(true);
        return;
      }

      setValidateManyRows(rows);
      setValidateManyOpen(true);
    } catch (e) {
      const message = toUserMessage(e, "Greška pri validaciji sesije.");
      setValidateOpen(false);
      setValidateManyRows([makeSessionErrorRow(message)]);
      setValidateManyOpen(true);
    } finally {
      setValidateBusy(false);
    }
  }, [session, status, entries, resetMutationErrors, validateSessionM, makeSessionErrorRow]);

  const confirmValidateAndFinalize = useCallback(async () => {
    if (finalizeBusyRef.current || finalizeBusy || finalizeM.isPending) return;

    try {
      setSuppressTopError(false);
      setScreenError(null);
      resetMutationErrors();

      finalizeBusyRef.current = true;
      setFinalizeBusy(true);
      setDetailFromMany(false);
      setValidateOneError(null);
      setValidateOneWarning(null);

      const result: any = await finalizeM.mutateAsync();
      const failed = Number(result?.failed ?? 0);
      clearDraftsForSession(sessionId);
      await sQ.refetch();

      if (failed > 0) {
        const failedItems = Array.isArray(result?.items)
          ? result.items.filter((item: any) => item?.success === false)
          : [];
        const details = failedItems
          .map((item: any) => cleanText(item?.error))
            .filter(Boolean)
            .join("\n");

        const message =
          `Sesija je zaključana nakon knjiženja, ali ${failed} unos${failed === 1 ? "" : "a"} nije uspješno knjiženo.`
          + (details ? `\n${details}` : "");

        setValidateOpen(false);
        setValidateManyRows([makeSessionErrorRow(message)]);
        setValidateManyOpen(true);
      } else {
        setValidateOpen(false);
        setValidateManyOpen(false);
      }
    } catch (e) {
      setValidateOpen(false);
      setValidateManyRows([makeSessionErrorRow(toUserMessage(e, "Greška pri knjiženju sesije."))]);
      setValidateManyOpen(true);
    } finally {
      finalizeBusyRef.current = false;
      setFinalizeBusy(false);
    }
  }, [finalizeBusy, finalizeM, sQ, sessionId, resetMutationErrors, makeSessionErrorRow]);

  const openDetailFromRow = useCallback((row: ValidateRow) => {
    setDetailFromMany(true);
    setValidateManyOpen(false);
    setValidateOneData(row.data);
    setValidateOneError(row.error);
    setValidateOneWarning(row.warning);
    setValidateOpen(true);
  }, []);

  const sessionStats = useMemo(() => {
    const total = entries.length;
    const draft = entries.filter((e: any) => entryMode(e) === "DRAFT").length;
    const fin = entries.filter((e: any) => entryMode(e) === "FINAL").length;
    return { total, draft, fin };
  }, [entries]);

  const renderEntry = useCallback(
    ({ item }: { item: BookingSessionEntryResponseDTO }) => {
      const e: any = item;
      const pid = Number(e?.partnerId);
      const nm = partnerName(pid, e);
      const avatar = initials(nm);
      const dm = entryMode(e);
      const pillLabel = dm === "FINAL" ? "FINAL" : "DRAFT";
      const b = badgeStyle(dm === "FINAL" ? "FINALIZED" : "DRAFT");
      const note = cleanDescription(e?.note);

      return (
        <Pressable
          style={[st.card, !canEdit && { opacity: 0.82 }]}
          disabled={!canEdit}
          onPress={() => openEntry(pid, entryNameHint(e))}
        >
          <View style={st.cardTop}>
            <View style={st.left}>
              <View style={st.avatar}>
                <Text style={st.avatarText}>{avatar}</Text>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.title} numberOfLines={1}>
                  {nm}
                </Text>
                <Text style={st.sub} numberOfLines={1}>
                  Partner
                </Text>
              </View>
            </View>

            <View style={[st.badge, { backgroundColor: b.backgroundColor, borderColor: b.borderColor }]}>
              <Text style={[st.badgeText, { color: b.textColor }]}>{pillLabel}</Text>
            </View>
          </View>

          {!!note && (
            <View style={st.noteBox}>
              <FontAwesome name="sticky-note" size={12} color={Colors.sub} />
              <Text style={st.noteText} numberOfLines={2}>
                {note}
              </Text>
            </View>
          )}

          <View style={st.divider} />

          <View style={st.rowBtns}>
            <Pressable
              style={[st.rowBtnPrimary, !canEdit && { opacity: 0.5 }]}
              disabled={!canEdit}
              onPress={() => openEntry(pid, entryNameHint(e))}
            >
              <FontAwesome name="folder-open" size={14} color="#fff" />
              <Text style={st.rowBtnPrimaryText}>Otvori</Text>
            </Pressable>

            <Pressable
              style={[
                st.rowBtnDanger,
                (!canEdit || delEntryM.isPending || finalizeM.isPending || validateBusy) && { opacity: 0.5 },
              ]}
              disabled={!canEdit || delEntryM.isPending || finalizeM.isPending || validateBusy}
              onPress={() => askDelete(pid, e)}
            >
              <FontAwesome name="trash" size={14} color={Colors.dangerText} />
              <Text style={st.rowBtnDangerText}>{delEntryM.isPending && deletePid === pid ? "…" : "Obriši"}</Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [partnerName, canEdit, openEntry, delEntryM.isPending, finalizeM.isPending, validateBusy, askDelete, deletePid]
  );

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader title={headerTitle} fallbackHref="/(tabs)/sessions" />

      <View style={st.container}>
        {!!topError && (
          <View style={st.topErrorWrap}>
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

        {!session ? (
          <View style={st.center}>
            {sQ.isLoading ? <ActivityIndicator /> : null}
            <Text style={st.helper}>{sQ.isLoading ? "Učitavam…" : "Nije pronađeno."}</Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item: any, idx) => {
              const partnerId = Number(item?.partnerId ?? 0);
              return partnerId > 0 ? `partner-${partnerId}` : `entry-${idx}`;
            }}
            renderItem={renderEntry}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              <View style={{ gap: 12 }}>
                <View style={st.heroCard}>
                  <View style={{ gap: 10 }}>
                    {!!cleanDescription((session as any).note) && (
                      <Text style={st.heroNote}>{cleanDescription((session as any).note)}</Text>
                    )}

                    <View style={st.heroTopRow}>
                      <View style={[st.badge, badgeStyle(status)]}>
                        <Text style={st.badgeText}>{statusHr(status)}</Text>
                      </View>

                      <View style={st.metaChip}>
                        <FontAwesome name="home" size={13} color={Colors.sub} />
                        <Text style={st.metaChipText}>
                          {warehouseId ? `Skladište #${warehouseId}` : "Dokumenti po unosu"}
                        </Text>
                      </View>
                    </View>

                    <View style={st.heroStatsRow}>
                      <View style={st.statChip}>
                        <Text style={st.statLabel}>Partneri</Text>
                        <Text style={st.statValue}>{sessionStats.total}</Text>
                      </View>
                      <View style={st.statChip}>
                        <Text style={st.statLabel}>Draft</Text>
                        <Text style={st.statValue}>{sessionStats.draft}</Text>
                      </View>
                      <View style={st.statChip}>
                        <Text style={st.statLabel}>Final</Text>
                        <Text style={st.statValue}>{sessionStats.fin}</Text>
                      </View>
                    </View>

                    {status === "DRAFT" ? (
                      <View style={st.heroBtns}>
                        <Pressable
                          style={st.primaryBtn}
                          onPress={openPartnerPicker}
                          disabled={finalizeM.isPending || validateBusy}
                        >
                          <FontAwesome name="plus" size={14} color="#fff" />
                          <Text style={st.primaryBtnText} numberOfLines={1}>Dodaj partnera</Text>
                        </Pressable>

                        <Pressable
                          style={[st.secondaryBtn, (finalizeM.isPending || validateBusy) && { opacity: 0.7 }]}
                          onPress={openScan}
                          disabled={finalizeM.isPending || validateBusy}
                        >
                          <FontAwesome name="camera" size={14} color={Colors.text} />
                          <Text style={st.secondaryBtnText} numberOfLines={1}>Skeniraj</Text>
                        </Pressable>

                        <Pressable
                          style={[st.secondaryBtn, (finalizeM.isPending || validateBusy) && { opacity: 0.7 }]}
                          onPress={startValidateThenConfirm}
                          disabled={finalizeM.isPending || validateBusy}
                        >
                          <FontAwesome name="check" size={14} color={Colors.text} />
                          <Text style={st.secondaryBtnText} numberOfLines={1}>
                            {finalizeM.isPending || validateBusy ? "…" : "Validiraj & knjiži"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={st.lockedLine}>
                        <FontAwesome name="lock" size={14} color={Colors.sub} />
                        <Text style={st.lockedText}>Sesija je zaključana - unosi se ne mogu mijenjati.</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={st.listHeader}>
                  <View style={{ gap: 2 }}>
                    <Text style={st.h2}>Unosi</Text>
                    <Text style={st.h2sub}>Po partneru</Text>
                  </View>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={st.emptyBox}>
                <FontAwesome name="info-circle" size={18} color={Colors.sub} />
                <Text style={st.helper}>{status === "DRAFT" ? "Nema unosa. Dodaj partnera." : "Nema unosa."}</Text>
              </View>
            }
          />
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

      <ValidateImpactModal
        visible={validateOpen}
        onClose={() => {
          if (validationModalBusy) return;
          setValidateOpen(false);

          if (detailFromMany) {
            setValidateManyOpen(true);
            setDetailFromMany(false);
          }
        }}
        disableClose={validationModalBusy}
        loading={validationModalBusy}
        loadingTitle={finalizeBusy || finalizeM.isPending ? "Knjižim…" : "Provjeravam…"}
        loadingSubtitle={finalizeBusy || finalizeM.isPending ? "Kreiram otpremnice i spremam evidenciju." : "Analiziram stavke i očekivane promjene."}
        error={validateOneError ? validateOneError : validateOneWarning ? validateOneWarning : null}
        data={validateOneData}
        onConfirm={confirmValidateAndFinalize}
        confirmText="Knjiži"
        showConfirm={!detailFromMany}
      />

      <ValidateManyModal
        visible={validateManyOpen}
        loading={validationModalBusy}
        rows={validateManyRows}
        disableClose={validationModalBusy}
        onClose={() => {
          if (validationModalBusy) return;
          setValidateManyOpen(false);
          setDetailFromMany(false);
        }}
        onConfirm={confirmValidateAndFinalize}
        onOpenDetail={openDetailFromRow}
        loadingTitle={finalizeBusy || finalizeM.isPending ? "Knjižim…" : "Provjeravam…"}
        loadingSubtitle={finalizeBusy || finalizeM.isPending ? "Kreiram otpremnice i zaključavam evidenciju." : "Molim pričekaj."}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, padding: 14, gap: 12 },
  topErrorWrap: { marginBottom: 2 },

  center: { padding: 20, alignItems: "center", justifyContent: "center", gap: 10 },
  helper: { color: Colors.sub, fontWeight: "800", textAlign: "center" },

  heroCard: {
    backgroundColor: "rgba(249,115,22,0.08)",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.22)",
    padding: 14,
  },
  heroNote: { color: Colors.text, fontWeight: "900", lineHeight: 19 },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  heroStatsRow: { flexDirection: "row", gap: 8 },

  statChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
    backgroundColor: "rgba(255,255,255,0.45)",
    paddingVertical: 8,
    alignItems: "center",
  },
  statLabel: { color: Colors.sub, fontWeight: "800", fontSize: 11 },
  statValue: { color: Colors.text, fontWeight: "900", fontSize: 15 },

  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  metaChipText: { color: Colors.sub, fontWeight: "900", fontSize: 12 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

  heroBtns: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  primaryBtn: {
    width: "100%",
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  secondaryBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 130,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { fontWeight: "900", color: Colors.text, fontSize: 13 },

  lockedLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  lockedText: { color: Colors.sub, fontWeight: "800", flex: 1 },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  h2: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  h2sub: { color: Colors.sub, fontWeight: "800" },

  smallPill: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  smallPillText: { fontWeight: "900", color: Colors.text },

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
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },

  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "900", color: Colors.text },

  title: { fontWeight: "900", color: Colors.text },
  sub: { color: Colors.sub, fontWeight: "800", fontSize: 12 },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  noteText: {
    flex: 1,
    color: Colors.text,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(2, 6, 23, 0.10)" },

  rowBtns: { flexDirection: "row", gap: 10 },

  rowBtnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  rowBtnPrimaryText: { color: "#fff", fontWeight: "900" },

  rowBtnDanger: {
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
  rowBtnDangerText: { color: Colors.dangerText, fontWeight: "900" },
});
