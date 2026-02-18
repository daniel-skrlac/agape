import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import TabScroll from "@/components/ui/TabScroll";
import { Banner } from "@/components/Banner";
import ValidateImpactModal from "@/components/ValidateImpactModal";

import Colors from "@/constants/Colors";
import Strings from "@/constants/Strings";


import { styles as s } from "./styles/DispatchBookingsDetails.styles";

import type { DispatchBookingDetailDTO, DispatchBookingItemDTO, DispatchRequestValidationDTO } from "@/app/models/generated";

import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import { toUserMessage } from "@/app/api/apiClient";

import {
  useCancelDispatchBooking,
  useDispatchBookingDetail,
  useDispatchBookingValidate,
  usePostDispatchBooking,
} from "@/app/api/hooks/dispatch-bookings/dispatchBookingHooks";

import { formatQtyHR, formatTimeHR } from "@/app/utils/format";
import { fmtHrDateTime } from "@/app/utils/dateIso";

function statusOf(dto: DispatchBookingDetailDTO): "DRAFT" | "FINAL" | "CANCELLED" {
  if ((dto as any)?.cancelled) return "CANCELLED";
  if ((dto as any)?.posted) return "FINAL";
  return "DRAFT";
}

function statusTone(st: "DRAFT" | "FINAL" | "CANCELLED") {
  if (st === "CANCELLED") return { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.28)", tx: Colors.dangerText ?? "#ef4444" };
  if (st === "FINAL") return { bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.30)", tx: Colors.text };
  return { bg: "rgba(59,130,246,0.10)", bd: "rgba(59,130,246,0.22)", tx: Colors.text };
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

export default function DispatchBookingDetails() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
  const numericId = Number(idRaw);
  const headerId = Number.isFinite(numericId) ? numericId : null;

  const detailsQ = useDispatchBookingDetail(headerId);
  const validateM = useDispatchBookingValidate();
  const postM = usePostDispatchBooking();
  const cancelM = useCancelDispatchBooking();

  const dto = detailsQ.booking as DispatchBookingDetailDTO | null;

  const [cancelReason, setCancelReason] = useState("");
  const [validateOpen, setValidateOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const st = useMemo(() => (dto ? statusOf(dto) : "DRAFT"), [dto]);
  const tone = useMemo(() => statusTone(st), [st]);

  const partnerLabel = useMemo(() => {
    if (!dto) return "—";
    const name = (dto as any)?.partnerName ? String((dto as any).partnerName) : "";
    const pid = (dto as any)?.partnerId != null ? String((dto as any).partnerId) : "";
    if (!name && !pid) return "—";
    return `${name || "Partner"}${pid ? ` (#${pid})` : ""}`;
  }, [dto]);

  const warehouseLabel = useMemo(() => {
    if (!dto) return "—";
    return (dto as any)?.warehouseId != null ? `Skladište #${(dto as any).warehouseId}` : "—";
  }, [dto]);

  const canPost = useMemo(() => {
    if (!dto) return false;
    if ((dto as any)?.posted) return false;
    if ((dto as any)?.cancelled) return false;
    return true;
  }, [dto]);

  const canCancel = useMemo(() => {
    if (!dto) return false;
    if (cancelM.loading) return false;
    if ((dto as any)?.cancelled) return false;
    return true;
  }, [dto, cancelM.loading]);

  const items: DispatchBookingItemDTO[] = useMemo(() => {
    const a = (dto as any)?.items ?? [];
    return Array.isArray(a) ? (a as DispatchBookingItemDTO[]) : [];
  }, [dto]);

  const topError = useMemo(() => {
    return detailsQ.errorMessage || null;
  }, [detailsQ.errorMessage]);

  const modalError = useMemo(() => {
    return validateM.errorMessage || postM.errorMessage || cancelM.errorMessage || localError || null;
  }, [validateM.errorMessage, postM.errorMessage, cancelM.errorMessage, localError]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      setLocalError(null);
      validateM.reset();
      postM.reset();
      cancelM.reset();
      await Promise.resolve(detailsQ.refetch());
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
      const res: any = await postM.post(headerId);
      if (res && typeof res === "object" && "headerId" in res) detailsQ.setBooking(res as any);
      else await Promise.resolve(detailsQ.refetch());
      setValidateOpen(false);
    } catch (e) {
      setLocalError(toUserMessage(e, Strings.settings.errors.generic));
    }
  }, [dto, headerId, canPost, postM, detailsQ]);

  const onCancel = useCallback(async () => {
    setLocalError(null);
    cancelM.reset();

    if (!headerId) return;

    try {
      const res: any = await cancelM.cancel(headerId, cancelReason);
      if (res && typeof res === "object" && "headerId" in res) detailsQ.setBooking(res as any);
      else await Promise.resolve(detailsQ.refetch());
    } catch (e) {
      setLocalError(toUserMessage(e, Strings.settings.errors.generic));
    }
  }, [headerId, cancelReason, cancelM, detailsQ]);

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

  if (detailsQ.loading) {
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
          {detailsQ.errorMessage ? <Banner type="error" text={detailsQ.errorMessage} /> : <Banner type="info" text="Nema podataka." />}
          <Pressable style={s.secondary} onPress={() => detailsQ.refetch()}>
            <Text style={s.secondaryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const stHuman = st === "CANCELLED" ? "STORNO" : st;

  const headerSubtitle = [
    stHuman,
    (dto as any)?.documentCode ? String((dto as any).documentCode) : null,
    partnerLabel !== "—" ? partnerLabel : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const metaRows = [
    kv("Header ID", (dto as any)?.headerId),
    kv("Skladište ID", (dto as any)?.warehouseId),
    kv("Dokument ID", (dto as any)?.documentId),
    kv("Šifra", (dto as any)?.documentCode),
    kv("Naziv", (dto as any)?.documentName),
    kv("Broj", (dto as any)?.documentBr),
    kv("Partner", partnerLabel),
  ];

  const timeRows = [
    kv("Datum dokumenta", formatTimeHR((dto as any)?.documentDate)),
    kv("Knjigovano/izrađeno", fmtHrDateTime((dto as any)?.bookedAt)),
    kv("Kreirano", fmtHrDateTime((dto as any)?.createdAt)),
    kv("Kreirao", (dto as any)?.createdBy),
    kv("Knjigovao", (dto as any)?.postedBy),
    kv("Knjigovano", fmtHrDateTime((dto as any)?.postedAt)),
    kv("Stornirao", (dto as any)?.cancelledBy),
    kv("Stornirano", fmtHrDateTime((dto as any)?.cancelledAt)),
  ];

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TopBar subtitle={headerSubtitle} />

      <TabScroll withScreen={false} refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={s.pad}>
        {!!topError && <Banner type="error" text={topError} />}

        <View style={s.statusRow}>
          <View style={[s.statusPill, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
            <Text style={[s.statusText, { color: tone.tx }]}>{stHuman}</Text>
          </View>

          <View style={{ flex: 1 }} />

          {!!(dto as any)?.cancelled && (
            <View style={[s.miniPill, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.25)" }]}>
              <Text style={s.miniText}>STORNO</Text>
            </View>
          )}
          {!!(dto as any)?.posted && !(dto as any)?.cancelled && (
            <View style={[s.miniPill, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }]}>
              <Text style={s.miniText}>KNJIŽENO</Text>
            </View>
          )}
          {!(dto as any)?.posted && !(dto as any)?.cancelled && (
            <View style={[s.miniPill, { backgroundColor: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.22)" }]}>
              <Text style={s.miniText}>DRAFT</Text>
            </View>
          )}
        </View>

        {canPost && (
          <Pressable style={[s.primary, (validateM.loading || postM.loading) && { opacity: 0.5 }]} disabled={validateM.loading || postM.loading} onPress={openValidate}>
            <Text style={s.primaryText}>{validateM.loading || postM.loading ? "Radim…" : "Validiraj i knjiži"}</Text>
          </Pressable>
        )}

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
                      {(code || unit) && (
                        <Text style={s.lineSub} numberOfLines={2}>
                          {code ? `Šifra: ${code}` : ""}
                          {code && unit ? " • " : ""}
                          {unit ? `JMJ: ${unit}` : ""}
                        </Text>
                      )}
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
          />

          <Pressable style={[s.danger, !canCancel && { opacity: 0.5 }]} disabled={!canCancel} onPress={onCancel}>
            {cancelM.loading ? <ActivityIndicator /> : <Text style={s.dangerTextBtn}>{st === "DRAFT" ? "Obriši draft" : "Storniraj dokument"}</Text>}
          </Pressable>
        </View>
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
    </Screen>
  );
}
