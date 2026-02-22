// app/(tabs)/sessions/[id]/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import NavigationHeader from "@/components/NavigationHeader";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import ValidateImpactModal from "@/components/ValidateImpactModal";

import type {
  BookingSessionEntryResponseDTO,
  BookingSessionResponseDTO,
  PartnerResponseDTO,
  DraftMode,
  DispatchRequestValidationDTO,
  TemplateBookDocPatchDTO,
  TemplateBookItemDTO,
  WarehouseBookingImpactDTO,
} from "@/app/models/generated";

import { partnerService } from "@/app/api/services/partnerService";
import { useBookingSession, useDeleteBookingSessionEntry, useFinalizeBookingSession } from "@/app/api/hooks/sessions/useBookingSessions";
import { useDispatchValidate } from "@/app/api/hooks/sessions/useDispatchValidate";
import { ApiError } from "@/app/api/apiClient";

import { getDraft } from "../_entryDraftStore";

/* ----------------------- helpers ----------------------- */

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
function initials(name: string) {
  const n = cleanText(name);
  if (!n) return "•";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "•";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

/** Show only backend "message" (no JSON dump). */
function getBackendMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as any;
    return (body?.message as string) || e.message || "Request failed";
  }
  if (e instanceof Error) return e.message || "Request failed";
  return "Request failed";
}

/** tiny concurrency helper (no caching; just faster) */
async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ----------------------- validate payload ----------------------- */

type QtyMap = Record<string, number>;
function addQtyToMap(qty: QtyMap, itemId: any, q: any) {
  const id = Number(itemId);
  const n = Number(q ?? 0);
  if (!id || !Number.isFinite(n) || n === 0) return;
  const k = String(id);
  qty[k] = Number(qty[k] ?? 0) + n;
}
function sumToItems(qty: QtyMap): TemplateBookItemDTO[] {
  return Object.entries(qty)
    .map(([k, v]) => ({ itemId: Number(k), quantity: Number(v) }))
    .filter((x) => x.itemId && x.quantity > 0)
    .sort((a, b) => Number(a.itemId) - Number(b.itemId));
}

/**
 * Build payload for validate endpoint for ONE partner entry.
 * Uses store draft if available to prevent "overriding with empty".
 */
function buildValidatePayloadFromEntry(args: {
  sessionId: number;
  warehouseId: number;
  partnerId: number;
  entry: any;
}): { payload: DispatchRequestValidationDTO; warning: string | null } {
  const { sessionId, warehouseId, partnerId, entry } = args;

  const draft = getDraft(sessionId, partnerId);

  const draftMode: DraftMode =
    ((draft?.draftMode as any) || (entry?.draftMode as any) || (entry?.draft ? ("DRAFT" as any) : ("FINAL" as any)) || ("DRAFT" as any)) as any;

  const note = (draft?.note ?? entry?.note ?? undefined) as any;

  const docPatches: TemplateBookDocPatchDTO[] =
    (draft?.docPatches as any) || (entry?.docPatches as any) || (entry?.documentPatches as any) || (entry?.patches as any) || [];

  const extraItems: TemplateBookItemDTO[] = (entry?.extraItems as any) || (entry?.extras as any) || [];

  const directItems: TemplateBookItemDTO[] = (entry?.items as any) || (entry?.validationItems as any) || (entry?.standaloneItems as any) || [];

  const qty: QtyMap = {};
  let warning: string | null = null;

  if (draft?.standaloneQty && typeof draft.standaloneQty === "object") {
    Object.entries(draft.standaloneQty).forEach(([k, v]) => addQtyToMap(qty, k, v));
  }

  (docPatches ?? []).forEach((p: any) => ((p?.addItems ?? []) as any[]).forEach((it) => addQtyToMap(qty, it?.itemId, it?.quantity)));

  (extraItems ?? []).forEach((it: any) => addQtyToMap(qty, it?.itemId, it?.quantity));

  if (Object.keys(qty).length === 0 && Array.isArray(directItems) && directItems.length > 0) {
    (directItems as any[]).forEach((it) => addQtyToMap(qty, it?.itemId, it?.quantity));
    warning = "Validacija koristi agregirane stavke iz entry payload-a.";
  }

  const items = sumToItems(qty);

  const payload: DispatchRequestValidationDTO = {
    warehouseId: Number(warehouseId),
    partnerId: Number(partnerId),
    documentDate: undefined as any,
    draft: draftMode === "DRAFT",
    note,
    items: items as any,
  } as any;

  return { payload, warning };
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

function classifyImpact(data: any) {
  const items: any[] = ((data as any)?.items ?? []) as any[];
  let ok = 0,
    warn = 0,
    bad = 0;
  for (const it of items) {
    if (!!it?.missingInWarehouse) bad++;
    else {
      const after = Number(String(it?.afterEffectiveQty ?? "").replace(",", "."));
      if (Number.isFinite(after) && after < 0) warn++;
      else ok++;
    }
  }
  return { ok, warn, bad, total: items.length };
}

/* ----------------------- validate-many modal ----------------------- */

function ValidateManyModal(props: {
  visible: boolean;
  loading: boolean;
  rows: ValidateRow[];
  onClose: () => void;
  onConfirm: () => void;
  onOpenDetail: (row: ValidateRow) => void;
  disableClose?: boolean;
}) {
  const { visible, loading, rows, onClose, onConfirm, onOpenDetail, disableClose } = props;

  const anyBad = rows.some((r) => r.bad > 0);
  const anyError = rows.some((r) => !!r.error);
  const canConfirm = !loading && !anyError && !anyBad;

  const anyWarning = rows.some((r) => !!r.warning);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={disableClose ? undefined : onClose}>
      <View style={st2.wrap}>
        <Pressable style={st2.backdrop} onPress={disableClose ? undefined : onClose} />

        <View style={st2.card}>
          <View style={st2.header}>
            <View style={{ flex: 1 }}>
              <Text style={st2.title}>Validacija prije knjiženja</Text>
              <Text style={st2.sub}>Pozivamo backend za svakog partnera. Draft iz store-a (ako postoji) je izvor istine.</Text>
            </View>

            <Pressable style={[st2.iconBtn, disableClose && { opacity: 0.5 }]} onPress={disableClose ? undefined : onClose} disabled={disableClose}>
              <FontAwesome name="close" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={st2.body} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={st2.stateBox}>
                <ActivityIndicator />
                <Text style={st2.stateTitle}>Provjeravam…</Text>
                <Text style={st2.stateSub}>Molim pričekaj.</Text>
              </View>
            ) : (
              <>
                {!!anyWarning && (
                  <View style={st2.warnBox}>
                    <View style={st2.warnHeader}>
                      <FontAwesome name="warning" size={16} color={Colors.text} />
                      <Text style={st2.warnTitle}>Napomena</Text>
                    </View>
                    <Text style={st2.warnText}>Neki unosi koriste store draft / agregirane stavke jer backend entry DTO nema default stavke dokumenata.</Text>
                  </View>
                )}

                {!!anyError && (
                  <View style={st2.errBox}>
                    <View style={st2.errHeader}>
                      <FontAwesome name="exclamation-triangle" size={16} color={Colors.dangerText} />
                      <Text style={st2.errTitle}>Validacija nije uspjela za neke partnere</Text>
                    </View>
                    {rows
                      .filter((r) => !!r.error)
                      .slice(0, 6)
                      .map((r) => (
                        <Text key={`e-${r.partnerId}`} style={st2.errText}>
                          {r.partnerName} • {r.error}
                        </Text>
                      ))}
                  </View>
                )}

                {!anyError && anyBad ? (
                  <View style={st2.badBox}>
                    <View style={st2.badHeader}>
                      <FontAwesome name="ban" size={16} color={Colors.dangerText} />
                      <Text style={st2.badTitle}>Neke stavke nisu u skladištu</Text>
                    </View>
                    <Text style={st2.badText}>Ne možemo knjižiti dok stavke koje nedostaju nisu dostupne.</Text>
                  </View>
                ) : null}

                <View style={{ gap: 10 }}>
                  {rows.map((r) => {
                    const pill =
                      !!r.error ? (
                        <View style={[st2.pill, { backgroundColor: Colors.dangerBg, borderColor: "rgba(239,68,68,0.35)" }]}>
                          <Text style={[st2.pillText, { color: Colors.dangerText }]}>ERROR</Text>
                        </View>
                      ) : r.bad > 0 ? (
                        <View style={[st2.pill, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.30)" }]}>
                          <Text style={st2.pillText}>NEMA: {r.bad}</Text>
                        </View>
                      ) : r.warn > 0 ? (
                        <View style={[st2.pill, { backgroundColor: "rgba(249,115,22,0.14)", borderColor: "rgba(249,115,22,0.30)" }]}>
                          <Text style={st2.pillText}>MINUS: {r.warn}</Text>
                        </View>
                      ) : (
                        <View style={[st2.pill, { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.30)" }]}>
                          <Text style={st2.pillText}>OK</Text>
                        </View>
                      );

                    return (
                      <Pressable key={`r-${r.partnerId}`} style={st2.rowCard} onPress={() => onOpenDetail(r)} android_disableSound>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={st2.rowName} numberOfLines={1}>
                              {r.partnerName}
                            </Text>
                            <Text style={st2.rowSub}>
                              Partner #{r.partnerId} • Validirano stavki: {r.total}
                              {!!r.warning ? " • ⚠️" : ""}
                            </Text>
                          </View>
                          {pill}
                        </View>

                        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={st2.smallHintPill}>
                            <FontAwesome name="search" size={12} color={Colors.sub} />
                            <Text style={st2.smallHintText}>Detalji</Text>
                          </View>
                          {!!r.warning ? (
                            <Text style={st2.warningLine} numberOfLines={2}>
                              {r.warning}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ gap: 10, marginTop: 6 }}>
                  <Pressable style={[st2.primary, !canConfirm && { opacity: 0.5 }]} onPress={onConfirm} disabled={!canConfirm}>
                    <Text style={st2.primaryText}>{canConfirm ? "Knjiži" : anyBad ? "Ne mogu knjižiti" : "Ne mogu nastaviti"}</Text>
                  </Pressable>

                  <Pressable style={st2.secondary} onPress={onClose} disabled={disableClose}>
                    <Text style={st2.secondaryText}>Zatvori</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------- screen ----------------------- */

export default function SessionDetailIndex() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);

  const sQ = useBookingSession(sessionId);
  const session = sQ.data as BookingSessionResponseDTO | undefined;

  const delEntryM = useDeleteBookingSessionEntry(sessionId);
  const finalizeM = useFinalizeBookingSession(sessionId);
  const validateM = useDispatchValidate();

  const err = (sQ.error as any)?.message || (delEntryM.error as any)?.message || (finalizeM.error as any)?.message || null;

  const headerTitle = cleanText((session as any)?.title) || "";

  const entries = useMemo(
    () => (((session as any)?.entries ?? []) as BookingSessionEntryResponseDTO[]),
    [session?.id, (session as any)?.entries?.length]
  );

  // ---------- partner names ----------
  const [partnerById, setPartnerById] = useState<Record<string, PartnerResponseDTO>>({});
  const [partnersLoading, setPartnersLoading] = useState(false);

  const loadRunRef = useRef(0);
  useEffect(() => {
    if (!session) return;

    const ids = entries.map((e: any) => Number(e.partnerId)).filter(Boolean);
    const uniq = Array.from(new Set(ids));

    if (!uniq.length) {
      setPartnerById({});
      setPartnersLoading(false);
      return;
    }

    setPartnersLoading(true);

    const runId = ++loadRunRef.current;
    let cancelled = false;

    (async () => {
      try {
        const results = await mapConcurrent(uniq, 3, async (id) => {
          try {
            const res = await partnerService.pagePartners({ page: 0, size: 10, q: String(id) });
            const hit = (res.items ?? []).find((p: any) => Number(p.id) === Number(id)) ?? null;
            return { id, hit } as { id: number; hit: PartnerResponseDTO | null };
          } catch {
            return { id, hit: null } as { id: number; hit: PartnerResponseDTO | null };
          }
        });

        if (cancelled) return;
        if (loadRunRef.current !== runId) return;

        const map: Record<string, PartnerResponseDTO> = {};
        for (const r of results) {
          if (r.hit) map[String((r.hit as any).id)] = r.hit;
        }

        setPartnerById(map);
      } finally {
        if (cancelled) return;
        if (loadRunRef.current !== runId) return;
        setPartnersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.id, entries.length]);

  const partnerName = (partnerId: number) => cleanText(partnerById[String(partnerId)]?.name || "");

  const openPartnerPicker = () => {
    router.push({ pathname: "/(tabs)/sessions/[id]/partner" as const, params: { id: String(sessionId) } });
  };

  const openEntry = (partnerId: number) => {
    router.push({
      pathname: "/(tabs)/sessions/[id]/entry" as const,
      params: { id: String(sessionId), partnerId: String(partnerId) },
    });
  };

  // ---------- delete confirm ----------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePid, setDeletePid] = useState<number | null>(null);
  const [deleteLbl, setDeleteLbl] = useState("");

  const askDelete = (pid: number) => {
    const nm = partnerName(pid);
    setDeletePid(pid);
    setDeleteLbl(nm ? `${nm} (#${pid})` : `Partner #${pid}`);
    setDeleteOpen(true);
  };

  const deleteEntry = async () => {
    if (!deletePid) return;
    await delEntryM.mutateAsync(Number(deletePid));
    setDeleteOpen(false);
    setDeletePid(null);
    await sQ.refetch();
  };

  const status = (session as any)?.status;
  const warehouseId = Number((session as any)?.warehouseId ?? 0) || null;

  // ---------- VALIDATE then CONFIRM then FINALIZE ----------
  const [validateOpen, setValidateOpen] = useState(false); // detail modal
  const [validateManyOpen, setValidateManyOpen] = useState(false);
  const [validateBusy, setValidateBusy] = useState(false);
  const [validateManyRows, setValidateManyRows] = useState<ValidateRow[]>([]);

  // detail modal state
  const [validateOneData, setValidateOneData] = useState<WarehouseBookingImpactDTO | null>(null);
  const [validateOneError, setValidateOneError] = useState<string | null>(null);
  const [validateOneWarning, setValidateOneWarning] = useState<string | null>(null);

  // ✅ when detail opened from MANY, hide per-partner "Knjiži"
  const [detailFromMany, setDetailFromMany] = useState(false);

  const startValidateThenConfirm = async () => {
    if (!session) return;
    if (status !== "DRAFT") return;

    if (!warehouseId) {
      setDetailFromMany(false);
      setValidateOneData(null);
      setValidateOneError("Nema skladišta na sesiji.");
      setValidateOneWarning(null);
      setValidateOpen(true);
      return;
    }

    if (!entries.length) {
      setDetailFromMany(false);
      setValidateOneData(null);
      setValidateOneError("Nema unosa za knjiženje.");
      setValidateOneWarning(null);
      setValidateOpen(true);
      return;
    }

    // ✅ single entry: open detail WITH "Knjiži"
    if (entries.length === 1) {
      const e: any = entries[0];
      const pid = Number(e?.partnerId);

      const { payload, warning } = buildValidatePayloadFromEntry({ sessionId, warehouseId, partnerId: pid, entry: e });

      setDetailFromMany(false);
      setValidateOpen(true);
      setValidateBusy(true);
      setValidateOneData(null);
      setValidateOneError(null);
      setValidateOneWarning(warning);

      validateM.reset();
      try {
        const data = (await validateM.mutateAsync(payload as any)) as any;
        setValidateOneData(data as any);
        setValidateOneError(null);
      } catch (ex) {
        setValidateOneData(null);
        setValidateOneError(getBackendMessage(ex));
      } finally {
        setValidateBusy(false);
      }
      return;
    }

    // ✅ many entries: show summary modal + ONLY bulk "Knjiži"
    setValidateManyOpen(true);
    setValidateBusy(true);
    setValidateManyRows([]);
    validateM.reset();

    try {
      const rows: ValidateRow[] = [];

      for (const e of entries as any[]) {
        const pid = Number(e?.partnerId);
        const nm = partnerName(pid) || `Partner #${pid}`;

        const { payload, warning } = buildValidatePayloadFromEntry({ sessionId, warehouseId, partnerId: pid, entry: e });

        try {
          const data = (await validateM.mutateAsync(payload as any)) as any;
          const c = classifyImpact(data);
          rows.push({ partnerId: pid, partnerName: nm, ...c, data: data as any, error: null, warning });
        } catch (ex) {
          rows.push({
            partnerId: pid,
            partnerName: nm,
            ok: 0,
            warn: 0,
            bad: 0,
            total: 0,
            data: null,
            error: getBackendMessage(ex),
            warning,
          });
        }
      }

      setValidateManyRows(rows);
    } finally {
      setValidateBusy(false);
    }
  };

  const confirmValidateAndFinalize = async () => {
    setValidateOpen(false);
    setValidateManyOpen(false);
    setDetailFromMany(false);

    await finalizeM.mutateAsync();
    await sQ.refetch();
  };

  const openDetailFromRow = (row: ValidateRow) => {
    // ✅ close MANY so detail is clickable/visible
    setDetailFromMany(true);
    setValidateManyOpen(false);

    setValidateOneData(row.data);
    setValidateOneError(row.error);
    setValidateOneWarning(row.warning);
    setValidateOpen(true);
  };

  const readyToRender = !!session && !partnersLoading;

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <NavigationHeader title={headerTitle || "Evidencija"} fallbackHref="/(tabs)/sessions" />

      <View style={st.container}>
        {!!err && <Banner type="error" text={String(err)} />}

        {!session ? (
          <View style={st.center}>
            {sQ.isLoading ? <ActivityIndicator /> : null}
            <Text style={st.helper}>{sQ.isLoading ? "Učitavam…" : "Nije pronađeno."}</Text>
          </View>
        ) : !readyToRender ? (
          <View style={st.center}>
            <ActivityIndicator />
            <Text style={st.helper}>Učitavam partnere…</Text>
          </View>
        ) : (
          <>
            {/* HERO */}
            <View style={st.heroCard}>
              <View style={{ gap: 8 }}>
                {!!cleanDescription((session as any).note) && <Text style={st.heroNote}>{cleanDescription((session as any).note)}</Text>}

                <View style={st.metaLine}>
                  <View style={[st.badge, badgeStyle(status)]}>
                    <Text style={st.badgeText}>{statusHr(status)}</Text>
                  </View>

                  <View style={st.metaRight}>
                    <View style={st.metaChip}>
                      <FontAwesome name="home" size={14} color={Colors.sub} />
                      <Text style={st.metaChipText}>Skladište #{(session as any).warehouseId}</Text>
                    </View>
                  </View>
                </View>

                {status === "DRAFT" ? (
                  <View style={st.heroBtns}>
                    <Pressable style={st.primaryBtn} onPress={openPartnerPicker} disabled={finalizeM.isPending || validateBusy}>
                      <FontAwesome name="plus" size={14} color="#fff" />
                      <Text style={st.primaryBtnText}>Dodaj partnera</Text>
                    </Pressable>

                    <Pressable
                      style={[st.secondaryBtn, (finalizeM.isPending || validateBusy) && { opacity: 0.7 }]}
                      onPress={startValidateThenConfirm}
                      disabled={finalizeM.isPending || validateBusy}
                    >
                      <FontAwesome name="check" size={14} color={Colors.text} />
                      <Text style={st.secondaryBtnText}>{finalizeM.isPending || validateBusy ? "…" : "Knjiži"}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={st.lockedLine}>
                    <FontAwesome name="lock" size={14} color={Colors.sub} />
                    <Text style={st.lockedText}>Sesija je zaključana – unosi se ne mogu mijenjati.</Text>
                  </View>
                )}
              </View>
            </View>

            {/* LIST HEADER */}
            <View style={st.listHeader}>
              <View style={{ gap: 2 }}>
                <Text style={st.h2}>Unosi</Text>
                <Text style={st.h2sub}>Po partneru</Text>
              </View>

              {status === "DRAFT" ? (
                <Pressable style={st.smallPill} onPress={openPartnerPicker} disabled={finalizeM.isPending || validateBusy}>
                  <Text style={st.smallPillText}>+ Partner</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
              {entries.length === 0 ? (
                <View style={st.emptyBox}>
                  <FontAwesome name="info-circle" size={18} color={Colors.sub} />
                  <Text style={st.helper}>Nema unosa. Dodaj partnera.</Text>
                </View>
              ) : (
                entries.map((item: any) => {
                  const pid = Number(item?.partnerId);
                  const dm = item?.draftMode;

                  const nm = partnerName(pid) || `Partner #${pid}`;
                  const avatar = initials(nm);

                  const pillLabel = dm === "FINAL" ? "FINAL" : "DRAFT";
                  const pillStatus = dm === "FINAL" ? "FINALIZED" : "DRAFT";

                  return (
                    <View key={String(item?.id ?? pid)} style={st.card}>
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
                              Partner #{pid}
                            </Text>
                          </View>
                        </View>

                        <View style={[st.badge, badgeStyle(pillStatus)]}>
                          <Text style={st.badgeText}>{pillLabel}</Text>
                        </View>
                      </View>

                      <View style={st.divider} />

                      <View style={st.rowBtns}>
                        <Pressable
                          style={[st.rowBtnPrimary, status !== "DRAFT" && { opacity: 0.5 }]}
                          disabled={status !== "DRAFT"}
                          onPress={() => openEntry(pid)}
                        >
                          <FontAwesome name="folder-open" size={14} color="#fff" />
                          <Text style={st.rowBtnPrimaryText}>Otvori</Text>
                        </Pressable>

                        <Pressable
                          style={[st.rowBtnDanger, status !== "DRAFT" && { opacity: 0.5 }]}
                          disabled={status !== "DRAFT" || delEntryM.isPending || finalizeM.isPending || validateBusy}
                          onPress={() => askDelete(pid)}
                        >
                          <FontAwesome name="trash" size={14} color={Colors.dangerText} />
                          <Text style={st.rowBtnDangerText}>{delEntryM.isPending ? "…" : "Obriši"}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
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

      {/* Detail modal:
          - single booking => show confirm ("Knjiži")
          - bulk booking (opened from "Detalji") => HIDE confirm (bulk only) */}
      <ValidateImpactModal
        visible={validateOpen}
        onClose={() => {
          if (validateBusy || finalizeM.isPending) return;
          setValidateOpen(false);

          // return back to MANY summary
          if (detailFromMany) {
            setValidateManyOpen(true);
            setDetailFromMany(false);
          }
        }}
        disableClose={validateBusy || finalizeM.isPending}
        loading={validateBusy}
        error={validateOneError ? validateOneError : validateOneWarning ? validateOneWarning : null}
        data={validateOneData}
        onConfirm={confirmValidateAndFinalize}
        confirmText="Knjiži"
        showConfirm={!detailFromMany} // ✅ THIS IS THE KEY
        bulkHint={detailFromMany ? "Bulk knjiženje: potvrda se radi na prethodnom ekranu." : null}
      />

      {/* Many partners modal */}
      <ValidateManyModal
        visible={validateManyOpen}
        loading={validateBusy}
        rows={validateManyRows}
        disableClose={validateBusy || finalizeM.isPending}
        onClose={() => {
          if (validateBusy || finalizeM.isPending) return;
          setValidateManyOpen(false);
          setDetailFromMany(false);
        }}
        onConfirm={confirmValidateAndFinalize}
        onOpenDetail={openDetailFromRow}
      />
    </Screen>
  );
}

/* ----------------------- styles ----------------------- */

const st = StyleSheet.create({
  container: { padding: 14, gap: 12 },

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

  metaLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginTop: 10 },

  metaRight: { alignItems: "flex-end", gap: 8 },
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
  metaChipText: { color: Colors.sub, fontWeight: "900" },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontWeight: "900", color: Colors.text },

  heroBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: Colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: { fontWeight: "900", color: Colors.text },

  lockedLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  lockedText: { color: Colors.sub, fontWeight: "800" },

  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  h2: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  h2sub: { color: Colors.sub, fontWeight: "800" },

  smallPill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
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
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },

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
  sub: { color: Colors.sub, fontWeight: "800" },

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

const st2 = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },

  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    overflow: "hidden",
    maxHeight: "88%",
  },

  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontWeight: "900", color: Colors.text, fontSize: 16, lineHeight: 20 },
  sub: { marginTop: 2, color: Colors.sub, fontWeight: "800", fontSize: 12, lineHeight: 16 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  body: { padding: 14, gap: 12, paddingBottom: 18 },

  stateBox: { paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  stateTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
  stateSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, textAlign: "center" },

  warnBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.28)",
    gap: 8,
  },
  warnHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  warnTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
  warnText: { fontWeight: "800", color: Colors.text, opacity: 0.95 },

  errBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.dangerBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.35)",
    gap: 8,
  },
  errHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  errTitle: { fontWeight: "900", color: Colors.dangerText, fontSize: 14 },
  errText: { fontWeight: "800", color: Colors.dangerText },

  badBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.28)",
    gap: 8,
  },
  badHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badTitle: { fontWeight: "900", color: Colors.dangerText, fontSize: 14 },
  badText: { fontWeight: "800", color: Colors.dangerText, opacity: 0.95 },

  rowCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    gap: 10,
  },
  rowName: { fontWeight: "900", color: Colors.text, fontSize: 15 },
  rowSub: { fontWeight: "800", color: Colors.sub, fontSize: 12, marginTop: 2 },

  warningLine: { flex: 1, fontWeight: "800", color: Colors.sub, fontSize: 12 },

  smallHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(2, 6, 23, 0.08)",
  },
  smallHintText: { fontWeight: "900", color: Colors.sub, fontSize: 12 },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderColor: Colors.border,
  },
  pillText: { fontWeight: "900", color: Colors.text, fontSize: 11 },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondary: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
