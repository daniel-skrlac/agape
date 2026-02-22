import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import { Banner } from "@/components/Banner";
import { ErrorCard } from "@/components/ErrorCard";
import ValidateImpactModal from "@/components/ValidateImpactModal";
import { CenterConfirmSheet } from "@/components/CenterConfirmSheet";
import InfoResultPopup from "@/components/InfoResultPopup";

import Colors from "@/constants/Colors";
import Strings from "@/constants/Strings";

import { styles as s } from "./styles/DispatchBookingsDetails.styles";

import type {
  DispatchBookingDetailDTO,
  DispatchBookingItemDTO,
  DispatchRequestValidationDTO,
} from "@/app/models/generated";

import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import { toUserMessage } from "@/app/api/apiClient";

import {
  useCancelDispatchBooking,
  useDispatchBookingDetail,
  useDispatchBookingValidate,
  usePostDispatchBooking,
} from "@/app/api/hooks/dispatch-bookings/dispatchBookingHooks";

import { formatQtyHR } from "@/app/utils/format";
import { fmtHrDateTime } from "@/app/utils/dateIso";

function statusOf(dto: DispatchBookingDetailDTO): "DRAFT" | "FINAL" | "CANCELLED" {
  if ((dto as any)?.cancelled) return "CANCELLED";
  if ((dto as any)?.posted) return "FINAL";
  return "DRAFT";
}

function statusTone(st: "DRAFT" | "FINAL" | "CANCELLED") {
  if (st === "CANCELLED") {
    return {
      bg: "rgba(239,68,68,0.12)",
      bd: "rgba(239,68,68,0.28)",
      tx: Colors.dangerText ?? "#ef4444",
    };
  }
  if (st === "FINAL") {
    return {
      bg: "rgba(34,197,94,0.14)",
      bd: "rgba(34,197,94,0.30)",
      tx: Colors.text,
    };
  }
  return {
    bg: "rgba(59,130,246,0.10)",
    bd: "rgba(59,130,246,0.22)",
    tx: Colors.text,
  };
}

function kv(label: string, value: any) {
  const v = value == null || String(value).trim() === "" ? "—" : String(value);
  return { label, value: v };
}

function buildValidatePayloadFromBooking(dto: DispatchBookingDetailDTO): DispatchRequestValidationDTO | null {
  const warehouseId = Number((dto as any)?.warehouseId);
  const partnerId = Number((dto as any)?.partnerId);
  if (!warehouseId || !partnerId) return null;

  const lines: any[] = Array.isArray((dto as any)?.items) ? ((dto as any).items as any[]) : [];

  const items = lines
    .map((ln) => {
      const itemId = Number(ln?.itemId);
      const quantity = Number(ln?.quantity ?? 0);
      if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return null;
      return { itemId, quantity };
    })
    .filter(Boolean)
    .sort((a, b) => Number((a as any).itemId) - Number((b as any).itemId));

  if (!items.length) return null;

  return {
    warehouseId,
    partnerId,
    draft: false,
    documentDate: undefined as any,
    note: undefined as any,
    items: items as any,
  } as any;
}

type ResultPopupState = {
  visible: boolean;
  kind: "success" | "error" | "info";
  title: string;
  message: string;
};

function tryExtractDetailDto(res: any): DispatchBookingDetailDTO | null {
  if (res && typeof res === "object" && "headerId" in res) return res as DispatchBookingDetailDTO;
  if (res?.data && typeof res.data === "object" && "headerId" in res.data) return res.data as DispatchBookingDetailDTO;
  if (res?.payload && typeof res.payload === "object" && "headerId" in res.payload) return res.payload as DispatchBookingDetailDTO;
  if (res?.result && typeof res.result === "object" && "headerId" in res.result) return res.result as DispatchBookingDetailDTO;
  return null;
}

export default function DispatchBookingDetails() {
  const params = useLocalSearchParams<{ id?: string | string[]; _rf?: string | string[] }>();
  const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const openRefreshToken = Array.isArray(params._rf) ? params._rf[0] : params._rf;

  const numericId = Number(idRaw);
  const headerId = Number.isFinite(numericId) ? numericId : null;

  const detailsQ = useDispatchBookingDetail(headerId);
  const validateM = useDispatchBookingValidate();
  const postM = usePostDispatchBooking();
  const cancelM = useCancelDispatchBooking();

  const dto = detailsQ.booking as DispatchBookingDetailDTO | null;

  const [cancelReason, setCancelReason] = useState("");
  const [validateOpen, setValidateOpen] = useState(false);
  const [stornoConfirmOpen, setStornoConfirmOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [resultPopup, setResultPopup] = useState<ResultPopupState>({
    visible: false,
    kind: "error",
    title: "",
    message: "",
  });

  const [retryingDetail, setRetryingDetail] = useState(false);
  const [hideTopError, setHideTopError] = useState(false);

  const stornoSubmittingRef = useRef(false);
  const [stornoSubmitting, setStornoSubmitting] = useState(false);

  const st = useMemo(() => (dto ? statusOf(dto) : "DRAFT"), [dto]);
  const tone = useMemo(() => statusTone(st), [st]);

  const partnerLabel = useMemo(() => {
    if (!dto) return "—";
    const name = (dto as any)?.partnerName ? String((dto as any)?.partnerName) : "";
    const pid = (dto as any)?.partnerId != null ? String((dto as any)?.partnerId) : "";
    if (!name && !pid) return "—";
    return `${name || "Partner"}${pid ? ` (#${pid})` : ""}`;
  }, [dto]);

  const canPost = useMemo(() => {
    if (!dto) return false;
    if ((dto as any)?.posted) return false;
    if ((dto as any)?.cancelled) return false;
    return true;
  }, [dto]);

  const canDeleteDraft = useMemo(() => {
    if (!dto) return false;
    if (cancelM.loading || stornoSubmitting) return false;
    if ((dto as any)?.cancelled) return false;
    if ((dto as any)?.posted) return false;
    return true;
  }, [dto, cancelM.loading, stornoSubmitting]);

  const canStorno = useMemo(() => {
    if (!dto) return false;
    if (cancelM.loading || stornoSubmitting) return false;
    if ((dto as any)?.cancelled) return false;
    if (!(dto as any)?.posted) return false;
    return true;
  }, [dto, cancelM.loading, stornoSubmitting]);

  const items: DispatchBookingItemDTO[] = useMemo(() => {
    const a = (dto as any)?.items ?? [];
    return Array.isArray(a) ? (a as DispatchBookingItemDTO[]) : [];
  }, [dto]);

  const topError = useMemo(() => detailsQ.errorMessage || null, [detailsQ.errorMessage]);
  const visibleTopError = useMemo(() => (hideTopError ? null : topError), [hideTopError, topError]);

  const modalError = useMemo(() => {
    return validateM.errorMessage || postM.errorMessage || localError || null;
  }, [validateM.errorMessage, postM.errorMessage, localError]);

  const stornoConfirmDesc = useMemo(() => {
    const docCode = String((dto as any)?.documentCode ?? "").trim();
    const base = docCode ? `Dokument: ${docCode}` : "Potvrdi storno dokumenta.";
    const reason = cancelReason.trim();
    return reason ? `${base}\nRazlog: ${reason}` : base;
  }, [dto, cancelReason]);

  const showResultError = useCallback((title: string, message: string) => {
    setResultPopup({
      visible: true,
      kind: "error",
      title,
      message,
    });
  }, []);

  const closeResultPopup = useCallback(() => {
    setResultPopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const goToCancelledIndex = useCallback(() => {
    const token = `${Date.now()}_${headerId ?? "x"}`;
    const href = {
      pathname: "/dispatch-bookings" as const,
      params: {
        status: "CANCELLED",
        _r: token,
        result: "STORNO_OK",
        resultHeaderId: headerId != null ? String(headerId) : undefined,
      },
    };

    requestAnimationFrame(() => {
      try {
        router.replace(href as any);
      } catch {
        try {
          const q = [
            `status=CANCELLED`,
            `_r=${encodeURIComponent(token)}`,
            `result=STORNO_OK`,
            headerId != null ? `resultHeaderId=${encodeURIComponent(String(headerId))}` : null,
          ]
            .filter(Boolean)
            .join("&");

          (router as any).replace?.(`/dispatch-bookings?${q}`);
        } catch { }
      }
    });
  }, [headerId]);

  const retryDetail = useCallback(async () => {
    setHideTopError(true);
    setRetryingDetail(true);

    setLocalError(null);
    setValidateOpen(false);
    setStornoConfirmOpen(false);
    setResultPopup((prev) => ({ ...prev, visible: false }));

    validateM.reset();
    postM.reset();
    cancelM.reset();

    stornoSubmittingRef.current = false;
    setStornoSubmitting(false);

    try {
      if ((detailsQ as any)?.refetchFresh) {
        await Promise.resolve((detailsQ as any).refetchFresh());
      } else {
        await Promise.resolve(detailsQ.refetch());
      }
    } catch {
    } finally {
      setRetryingDetail(false);
      setHideTopError(false);
    }
  }, [detailsQ, validateM, postM, cancelM]);

  const handledOpenRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openRefreshToken || !headerId) return;
    if (handledOpenRefreshRef.current === openRefreshToken) return;

    handledOpenRefreshRef.current = openRefreshToken;
    void retryDetail();
  }, [openRefreshToken, headerId, retryDetail]);

  const onTopErrorAction = useCallback(() => {
    void retryDetail();
  }, [retryDetail]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      await retryDetail();
    },
  ]);

  const openValidate = useCallback(async () => {
    setLocalError(null);
    validateM.reset();
    postM.reset();

    if (!dto || !headerId) return;

    if (!canPost) {
      setLocalError((dto as any)?.cancelled ? "Dokument je već storniran." : "Dokument je već knjižen.");
      return;
    }

    const payload = buildValidatePayloadFromBooking(dto);
    if (!payload) {
      setLocalError("Nedostaju podaci za validaciju (warehouseId/partnerId/stavke).");
      return;
    }

    setValidateOpen(true);

    try {
      await validateM.validate(payload);
    } catch {
    }
  }, [dto, headerId, canPost, validateM, postM]);

  const confirmValidateAndPost = useCallback(async () => {
    setLocalError(null);

    if (!dto || !headerId) return;

    if (!canPost) {
      setLocalError((dto as any)?.cancelled ? "Dokument je već storniran." : "Dokument je već knjižen.");
      return;
    }

    try {
      const res: any = await postM.post(headerId, { invalidateDetail: false });
      const nextDto = tryExtractDetailDto(res);

      if (nextDto) detailsQ.setBooking(nextDto as any);
      else await Promise.resolve(detailsQ.refetch());

      setValidateOpen(false);
    } catch (e) {
      setLocalError(toUserMessage(e, Strings.settings.errors.generic));
    }
  }, [dto, headerId, canPost, postM, detailsQ]);

  const onDeleteDraft = useCallback(async () => {
    setLocalError(null);
    cancelM.reset();

    if (!headerId || !dto) return;

    if ((dto as any)?.posted || (dto as any)?.cancelled) {
      setLocalError("Brisanje je moguće samo za draft dokumente.");
      return;
    }

    try {
      const res: any = await cancelM.cancel(headerId, "", { invalidateDetail: false });
      const nextDto = tryExtractDetailDto(res);

      if (nextDto) detailsQ.setBooking(nextDto as any);
      else await Promise.resolve(detailsQ.refetch());

      setValidateOpen(false);
      setStornoConfirmOpen(false);
    } catch (e) {
      setLocalError(toUserMessage(e, Strings.settings.errors.generic));
    }
  }, [headerId, dto, cancelM, detailsQ]);

  const openStornoConfirm = useCallback(() => {
    if (stornoSubmittingRef.current || cancelM.loading) return;

    setLocalError(null);
    setResultPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setStornoConfirmOpen(true);
  }, [cancelM.loading]);

  const onStorno = useCallback(async () => {
    if (stornoSubmittingRef.current || cancelM.loading) return;
    if (!headerId || !dto) return;

    if (!(dto as any)?.posted || (dto as any)?.cancelled) {
      setStornoConfirmOpen(false);
      showResultError("Greška", "Storno je moguće samo za knjižene dokumente.");
      return;
    }

    cancelM.reset();
    stornoSubmittingRef.current = true;
    setStornoSubmitting(true);
    setLocalError(null);

    let navigated = false;

    try {
      await cancelM.cancel(headerId, cancelReason, { invalidateDetail: false });

      setStornoConfirmOpen(false);
      navigated = true;
      goToCancelledIndex();
      return;
    } catch (e) {
      setStornoConfirmOpen(false);
      showResultError("Storno nije uspio", toUserMessage(e, Strings.settings.errors.generic));
    } finally {
      if (!navigated) {
        stornoSubmittingRef.current = false;
        setStornoSubmitting(false);
      }
    }
  }, [headerId, dto, cancelReason, cancelM, goToCancelledIndex, showResultError]);

  const closeStornoConfirm = useCallback(() => {
    if (cancelM.loading || stornoSubmittingRef.current || stornoSubmitting) return;
    setStornoConfirmOpen(false);
  }, [cancelM.loading, stornoSubmitting]);

  const TopBar = ({ subtitle }: { subtitle: string }) => (
    <View style={s.topBar}>
      <Pressable style={s.iconBtn} onPress={() => router.back()}>
        <FontAwesome name="chevron-left" size={16} color={Colors.text} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={s.h1} numberOfLines={1}>
          Dispatch #{String(headerId ?? "")}
        </Text>
        <Text style={s.h2} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );

  if (!headerId) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle="Neispravan ID" />
        <View style={s.padPlain}>
          <Banner type="error" text="Neispravan ID." />
          <Pressable style={s.secondary} onPress={() => router.back()}>
            <Text style={s.secondaryText}>Nazad</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if ((detailsQ.loading || retryingDetail) && !dto) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle="Učitavam…" />
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Učitavam…</Text>
        </View>
      </Screen>
    );
  }

  if (!dto) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle={detailsQ.errorMessage ? "Greška" : "Nema podataka"} />
        <View style={s.padPlain}>
          {!!visibleTopError ? (
            <ErrorCard
              title="Greška"
              message={visibleTopError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              disabled={retryingDetail || refreshing}
              titleLines={1}
              messageLines={2}
            />
          ) : (
            <Banner type="info" text="Nema podataka." />
          )}

          <Pressable style={s.secondary} onPress={onTopErrorAction} disabled={retryingDetail || refreshing}>
            <Text style={s.secondaryText}>{retryingDetail || refreshing ? "Učitavam…" : "Pokušaj ponovno"}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const stHuman = st === "CANCELLED" ? "STORNO" : st;

  const headerSubtitle = [
    stHuman,
    (dto as any)?.documentCode ? String((dto as any)?.documentCode) : null,
    partnerLabel !== "—" ? partnerLabel : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const metaRows = [
    kv("Glava ID", (dto as any)?.headerId),
    kv("Skladište ID", (dto as any)?.warehouseId),
    kv("Dokument ID", (dto as any)?.documentId),
    kv("Šifra", (dto as any)?.documentCode),
    kv("Naziv", (dto as any)?.documentName),
    kv("Broj", (dto as any)?.documentBr),
    kv("Partner", partnerLabel),
  ];

  const timeRows = [
    kv("Datum dokumenta", fmtHrDateTime((dto as any)?.documentDate)),
    kv("Knjiženo/izrađeno", fmtHrDateTime((dto as any)?.bookedAt)),
    kv("Kreirano", fmtHrDateTime((dto as any)?.createdAt)),
    kv("Kreirao", (dto as any)?.createdBy),
    kv("Knjižio", (dto as any)?.postedBy),
    kv("Knjiženo", fmtHrDateTime((dto as any)?.postedAt)),
    kv("Stornirao", (dto as any)?.cancelledBy),
    kv("Stornirano", fmtHrDateTime((dto as any)?.cancelledAt)),
  ];

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TopBar subtitle={headerSubtitle} />

      <TabScroll withScreen={false} refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={s.pad}>
        {!!visibleTopError ? (
          <View style={{ marginBottom: 10 }}>
            <ErrorCard
              title="Greška"
              message={visibleTopError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              disabled={retryingDetail || refreshing}
              titleLines={1}
              messageLines={2}
            />
          </View>
        ) : null}

        <View style={s.statusRow}>
          <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
            <Text style={[s.statusText, { color: tone.tx }]}>{stHuman}</Text>
          </View>

          <View style={{ flex: 1 }} />

          {!!(dto as any)?.cancelled && (
            <View
              style={[
                s.miniPill,
                { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.25)" },
              ]}
            >
              <Text style={s.miniText}>STORNO</Text>
            </View>
          )}
          {!!(dto as any)?.posted && !(dto as any)?.cancelled && (
            <View
              style={[
                s.miniPill,
                { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" },
              ]}
            >
              <Text style={s.miniText}>KNJIŽENO</Text>
            </View>
          )}
          {!(dto as any)?.posted && !(dto as any)?.cancelled && (
            <View
              style={[
                s.miniPill,
                { backgroundColor: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.22)" },
              ]}
            >
              <Text style={s.miniText}>DRAFT</Text>
            </View>
          )}
        </View>

        {canPost ? (
          <Pressable
            style={[s.primary, (validateM.loading || postM.loading) && { opacity: 0.5 }]}
            disabled={validateM.loading || postM.loading}
            onPress={openValidate}
          >
            <Text style={s.primaryText}>{validateM.loading || postM.loading ? "Radim…" : "Validiraj i knjiži"}</Text>
          </Pressable>
        ) : null}

        <View style={s.card}>
          <Text style={s.cardTitle}>Podaci</Text>
          <View style={s.kvGrid}>
            {metaRows.map((r) => (
              <View key={r.label} style={s.kvCell}>
                <Text style={s.k}>{r.label}</Text>
                <Text style={s.v}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Vremena / korisnici</Text>
          <View style={s.kvGrid}>
            {timeRows.map((r) => (
              <View key={r.label} style={s.kvCell}>
                <Text style={s.k}>{r.label}</Text>
                <Text style={s.v}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.cardTitle}>Stavke</Text>
            <View style={s.countPill}>
              <Text style={s.countText}>{items.length}</Text>
            </View>
          </View>

          {items.length === 0 ? (
            <Text style={s.empty}>Nema stavki.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((ln: any, idx: number) => {
                const key = String(ln?.id ?? ln?.itemRowId ?? ln?.itemId ?? `${idx}`);
                const name = String(ln?.name ?? ln?.itemName ?? "");
                const code = String(ln?.itemCode ?? "");
                const qty = ln?.quantity != null ? formatQtyHR(Number(ln.quantity)) : "—";
                const unit = String(ln?.unit ?? ln?.unitOfMeasure ?? ln?.jmj ?? "");

                return (
                  <View key={key} style={s.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.lineTitle} numberOfLines={2}>
                        {name || "Stavka"}
                      </Text>
                      {code || unit ? (
                        <Text style={s.lineSub} numberOfLines={2}>
                          {code ? `Šifra: ${code}` : ""}
                          {code && unit ? " • " : ""}
                          {unit ? `JMJ: ${unit}` : ""}
                        </Text>
                      ) : null}
                    </View>

                    <View style={s.qtyBox}>
                      <Text style={s.qty}>{qty}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {canDeleteDraft ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Draft</Text>

            <Pressable
              style={[s.danger, (cancelM.loading || stornoSubmitting) && { opacity: 0.5 }]}
              disabled={cancelM.loading || stornoSubmitting}
              onPress={onDeleteDraft}
            >
              {cancelM.loading || stornoSubmitting ? <ActivityIndicator /> : <Text style={s.dangerTextBtn}>Obriši draft</Text>}
            </Pressable>
          </View>
        ) : null}

        {canStorno ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Storno</Text>

            <Text style={s.lbl}>Razlog (opcionalno)</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Upiši razlog…"
              placeholderTextColor={Colors.sub}
              style={s.input}
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              blurOnSubmit={false}
            />

            <Pressable
              style={[s.danger, (cancelM.loading || stornoSubmitting) && { opacity: 0.5 }]}
              disabled={cancelM.loading || stornoSubmitting}
              onPress={openStornoConfirm}
            >
              {cancelM.loading || stornoSubmitting ? <ActivityIndicator /> : <Text style={s.dangerTextBtn}>Storniraj dokument</Text>}
            </Pressable>
          </View>
        ) : null}
      </TabScroll>

      <ValidateImpactModal
        visible={validateOpen}
        onClose={() => {
          if (validateM.loading || postM.loading) return;
          setValidateOpen(false);
        }}
        disableClose={validateM.loading || postM.loading}
        loading={validateM.loading || postM.loading}
        error={modalError}
        data={validateM.data}
        onConfirm={confirmValidateAndPost}
        confirmText={postM.loading ? "Knjižim…" : "Knjiži"}
      />

      <CenterConfirmSheet
        visible={stornoConfirmOpen}
        title="Stornirati dokument?"
        description={stornoConfirmDesc}
        confirmText="Storniraj"
        danger
        loading={cancelM.loading || stornoSubmitting}
        onClose={closeStornoConfirm}
        onConfirm={onStorno}
        closeOnBackdrop={false}
      />

      <InfoResultPopup
        visible={resultPopup.visible}
        variant={resultPopup.kind}
        title={resultPopup.title}
        message={resultPopup.message}
        buttonText="U redu"
        subtitle={resultPopup.kind === "error" ? "Provjeri poruku i pokušaj ponovno." : undefined}
        onClose={closeResultPopup}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}