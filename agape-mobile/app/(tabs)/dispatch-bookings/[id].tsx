// app/(tabs)/bookings/[id].tsx
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import ValidateImpactModal from "@/components/ValidateImpactModal";

import { useCancelDispatch } from "@/app/api/hooks/useCancelDispatch";
import { useDispatchDetails } from "@/app/api/hooks/useDispatchDetails";
import { useDispatchValidate } from "@/app/api/hooks/useDispatchValidate";

import type { DispatchBookingDetailDTO, DispatchBookingItemDTO, DispatchRequestValidationDTO } from "@/app/models/generated";
import { ApiError } from "@/app/api/apiClient";
import { api } from "@/app/api/api";
// ✅ USE YOUR EXISTING api (createApiClient). Adjust path if needed.

const MAX_W = 560;

// ✅ Adjust if your backend path differs
const POST_ENDPOINT = (id: number) => `/api/v1/dispatch-bookings/${id}/post`;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateSafe(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date && !Number.isNaN(x.getTime())) return x;
  const d = new Date(String(x));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtHrDateTime(x: any): string {
  const d = toDateSafe(x);
  if (!d) return "—";
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

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

/** Show only backend "message" (no JSON dump). */
function getBackendMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as any;
    return (body?.message as string) || e.message || "Request failed";
  }
  if (e instanceof Error) return e.message || "Request failed";
  return "Request failed";
}

/**
 * Same idea as Otpremi:
 * - validate needs: warehouseId + partnerId + items[]
 * - draft flag should be false because we are going to POST/knjiži
 */
function buildValidatePayloadFromBooking(dto: DispatchBookingDetailDTO): DispatchRequestValidationDTO | null {
  const warehouseId = Number((dto as any)?.warehouseId);
  const partnerId = Number((dto as any)?.partnerId);
  if (!warehouseId || !partnerId) return null;

  const lines: any[] = Array.isArray((dto as any)?.items) ? ((dto as any).items as any[]) : [];

  // IMPORTANT: prefer line.itemId (NOT line.id which is often row-id)
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
    documentDate: undefined as any,
    draft: false,
    note: undefined as any,
    items: items as any,
  } as any;
}

export default function DispatchBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const validId = Number.isFinite(numericId) ? numericId : null;

  const q = useDispatchDetails(validId);
  const cancelM = useCancelDispatch();
  const validateM = useDispatchValidate();

  const [cancelReason, setCancelReason] = useState("");

  // ✅ like Otpremi: modal visible state + confirm callback
  const [validateOpen, setValidateOpen] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const dto = q.data as DispatchBookingDetailDTO | null;

  const st = useMemo(() => (dto ? statusOf(dto) : null), [dto]);
  const tone = useMemo(() => (st ? statusTone(st) : null), [st]);

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

  // ✅ this is your "submit" action after validate confirm
  const postM = useMutation({
    mutationFn: async (bookingId: number) => {
      // using YOUR api client (with onUnauthorized etc)
      return api.request(POST_ENDPOINT(bookingId), {} as any);
    },
  });

  const validateLoading = validateM.isPending;
  const validateData = validateM.data ?? null;
  const validateError = validateM.error ? getBackendMessage(validateM.error) : null;
  const posting = postM.isPending;

  const openValidate = async () => {
    setPostError(null);

    if (!validId || !dto) return;

    // only if draft and not cancelled
    if ((dto as any)?.cancelled) {
      setPostError("Dokument je već storniran.");
      return;
    }
    if ((dto as any)?.posted) {
      setPostError("Dokument je već knjižen.");
      return;
    }

    const payload = buildValidatePayloadFromBooking(dto);
    if (!payload) {
      setPostError("Nedostaju podaci za validaciju (warehouseId/partnerId/stavke).");
      return;
    }

    if (!(payload.items as any[])?.length) {
      setPostError("Nema stavki za validaciju.");
      return;
    }

    setValidateOpen(true);
    validateM.reset();

    try {
      await validateM.mutateAsync(payload as any);
    } catch {
      // error shown via validateError in modal
    }
  };

  const confirmValidateAndPost = async () => {
    if (!validId || !dto) return;
    if (posting || validateLoading) return;

    setPostError(null);

    try {
      const res: any = await postM.mutateAsync(validId);

      // if backend returns updated booking details -> apply, else refetch
      if (res) q.setData(res as any);
      else q.refetch();

      setValidateOpen(false);
    } catch (e) {
      setPostError(getBackendMessage(e));
      // keep modal open to show error
    }
  };

  const TopBar = ({ subtitle }: { subtitle: string }) => (
    <View style={s.topBar}>
      <Pressable style={s.iconBtn} onPress={() => router.back()}>
        <FontAwesome name="chevron-left" size={16} color={Colors.text} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={s.h1} numberOfLines={1}>
          Dispatch #{String(validId ?? "")}
        </Text>
        <Text style={s.h2} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <Pressable style={s.iconBtn} onPress={q.refetch}>
        <FontAwesome name="refresh" size={16} color={Colors.text} />
      </Pressable>
    </View>
  );

  if (!validId) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle="Neispravan ID" />
        <View style={s.pad}>
          <Banner type="error" text="Neispravan ID." />
          <Pressable style={s.secondary} onPress={() => router.back()}>
            <Text style={s.secondaryText}>Nazad</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (q.loading) {
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

  if (q.error) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle="Greška" />
        <View style={s.pad}>
          <Banner type="error" text={q.error} />
          <Pressable style={s.secondary} onPress={q.refetch}>
            <Text style={s.secondaryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!dto) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <TopBar subtitle="Nema podataka" />
        <View style={s.pad}>
          <Banner type="info" text="Nema podataka." />
        </View>
      </Screen>
    );
  }

  const stLabel = st ?? "DRAFT";
  const stHuman = stLabel === "CANCELLED" ? "STORNO" : stLabel;

  const headerSubtitle = [stHuman, (dto as any)?.documentCode ? (dto as any).documentCode : null, partnerLabel !== "—" ? partnerLabel : null, warehouseLabel !== "—" ? warehouseLabel : null]
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
    kv("Datum dokumenta", fmtHrDateTime((dto as any)?.documentDate)),
    kv("Knjigovano/izrađeno", fmtHrDateTime((dto as any)?.bookedAt)),
    kv("Kreirano", fmtHrDateTime((dto as any)?.createdAt)),
    kv("Kreirao", (dto as any)?.createdBy),
    kv("Knjigovao", (dto as any)?.postedBy),
    kv("Knjigovano", fmtHrDateTime((dto as any)?.postedAt)),
    kv("Stornirao", (dto as any)?.cancelledBy),
    kv("Stornirano", fmtHrDateTime((dto as any)?.cancelledAt)),
  ];

  const canPost = !(dto as any)?.posted && !(dto as any)?.cancelled;

  return (
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <TopBar subtitle={headerSubtitle} />

      <ScrollView contentContainerStyle={s.pad}>
        {!!(cancelM.error || postError) && <Banner type="error" text={(cancelM.error || postError) as string} />}

        <View style={s.statusRow}>
          <View style={[s.statusPill, { backgroundColor: tone?.bg, borderColor: tone?.bd }]}>
            <Text style={[s.statusText, { color: tone?.tx }]}>{stHuman}</Text>
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

        {/* ✅ Validate + Post (same flow as Otpremi) */}
        {canPost && (
          <Pressable style={[s.primary, (posting || validateLoading) && { opacity: 0.5 }]} disabled={posting || validateLoading} onPress={openValidate}>
            <Text style={s.primaryText}>{posting || validateLoading ? "Radim…" : "Validiraj i knjiži"}</Text>
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
                const qty = ln?.quantity != null ? String(ln.quantity) : "";
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
                      <Text style={s.qty}>{qty || "—"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Storno / delete draft (your existing logic) */}
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

          <Pressable
            style={[s.danger, !canCancel && { opacity: 0.5 }]}
            disabled={!canCancel}
            onPress={async () => {
              cancelM.setError(null);
              const res = await cancelM.cancel(validId, cancelReason);
              if (res) q.setData(res as any);
            }}
          >
            {cancelM.loading ? <ActivityIndicator /> : <Text style={s.dangerTextBtn}>{stLabel === "DRAFT" ? "Obriši draft" : "Storniraj dokument"}</Text>}
          </Pressable>
        </View>

        <Pressable style={s.secondary} onPress={() => router.back()}>
          <Text style={s.secondaryText}>Nazad</Text>
        </Pressable>
      </ScrollView>

      <ValidateImpactModal
        visible={validateOpen}
        onClose={() => {
          if (posting || validateLoading) return;
          setValidateOpen(false);
        }}
        disableClose={posting || validateLoading}
        loading={validateLoading || posting}
        error={validateError || postError}
        data={validateData}
        onConfirm={confirmValidateAndPost}
        confirmText={posting ? "Knjižim…" : "Knjiži"}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  pad: { padding: 14, gap: 12 },
  h1: { fontWeight: "900", color: Colors.text, fontSize: 16 },
  h2: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  muted: { color: Colors.sub, fontWeight: "800" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  statusText: { fontWeight: "900", fontSize: 12 },

  miniPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  miniText: { fontWeight: "900", color: Colors.text, fontSize: 11 },

  primary: { padding: 12, borderRadius: 14, backgroundColor: Colors.orange, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },

  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    gap: 10,
  },
  cardTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  kvGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kvCell: {
    width: "48%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.08)",
    padding: 10,
    gap: 4,
  },
  k: { color: Colors.sub, fontWeight: "900", fontSize: 11 },
  v: { color: Colors.text, fontWeight: "900", fontSize: 12 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  countPill: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,115,22,0.30)",
  },
  countText: { fontWeight: "900", color: Colors.text, fontSize: 12 },

  empty: { color: Colors.sub, fontWeight: "800", paddingVertical: 6 },

  lineRow: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lineTitle: { fontWeight: "900", color: Colors.text, fontSize: 13, lineHeight: 17 },
  lineSub: { marginTop: 2, fontWeight: "800", color: Colors.sub, fontSize: 12 },

  qtyBox: { minWidth: 52, alignItems: "flex-end", justifyContent: "center" },
  qty: { fontWeight: "900", color: Colors.text, fontSize: 14, textAlign: "right" },

  lbl: { color: Colors.sub, fontWeight: "900", fontSize: 12, marginTop: 4 },
  input: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
    padding: 12,
    color: Colors.text,
    fontWeight: "800",
  },

  danger: { padding: 12, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.95)", alignItems: "center" },
  dangerTextBtn: { color: "#fff", fontWeight: "900" },

  secondary: { padding: 12, borderRadius: 14, backgroundColor: "rgba(148,163,184,0.18)", alignItems: "center" },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
