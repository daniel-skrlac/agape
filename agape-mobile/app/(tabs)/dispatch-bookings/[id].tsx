// app/dispatch-bookings/[id].tsx
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { useCancelDispatch } from "@/app/api/hooks/useCancelDispatch";
import { useDispatchDetails } from "@/app/api/hooks/useDispatchDetails";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtHrDate(x: any): string {
  if (!x) return "";
  const d = x instanceof Date ? x : new Date(String(x));
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function statusOfRow(d: any): "DRAFT" | "FINAL" | "CANCELLED" {
  const s = String(d?.status ?? "").toUpperCase();
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("POST") || s.includes("FINAL")) return "FINAL";
  if (s.includes("DRAFT")) return "DRAFT";
  if (d?.cancelled === true || d?.storno === 1) return "CANCELLED";
  if (d?.posted === true || d?.knjizeno === 1) return "FINAL";
  return "DRAFT";
}

export default function DispatchBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const validId = Number.isFinite(numericId) ? numericId : null;

  const q = useDispatchDetails(validId);
  const cancelM = useCancelDispatch();

  const [cancelReason, setCancelReason] = useState("");

  const header = q.data as any;

  const st = useMemo(() => statusOfRow(header), [header]);
  const canCancel = useMemo(() => !!header && st !== "CANCELLED" && !cancelM.loading, [header, st, cancelM.loading]);

  const lines: any[] = useMemo(() => {
    const a = header?.items ?? header?.lines ?? header?.stavke ?? [];
    return Array.isArray(a) ? a : [];
  }, [header]);

  if (!validId) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <View style={s.pad}>
          <Banner type="error" text="Neispravan ID." />
          <Pressable style={s.secondary} onPress={() => router.back()}>
            <Text style={s.secondaryText}>Nazad</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const partnerName = String(header?.partnerName ?? "");
  const partnerId = header?.partnerId != null ? String(header?.partnerId) : "";

  return (
    // IMPORTANT: no TOP safe-area padding
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <View style={s.topBar}>
        <Pressable style={s.iconBtn} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={16} color={Colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={s.h1} numberOfLines={1}>
            Dispatch #{String(validId)}
          </Text>
          <Text style={s.h2} numberOfLines={2}>
            {st} • {String(header?.documentCode ?? "")}
            {partnerName || partnerId ? ` • ${partnerName || "Partner"}${partnerId ? ` (#${partnerId})` : ""}` : ""}
          </Text>
        </View>

        <Pressable style={s.iconBtn} onPress={q.refetch}>
          <FontAwesome name="refresh" size={16} color={Colors.text} />
        </Pressable>
      </View>

      {q.loading ? (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Učitavam…</Text>
        </View>
      ) : q.error ? (
        <View style={s.pad}>
          <Banner type="error" text={q.error} />
          <Pressable style={s.secondary} onPress={q.refetch}>
            <Text style={s.secondaryText}>Pokušaj ponovno</Text>
          </Pressable>
        </View>
      ) : !q.data ? (
        <View style={s.pad}>
          <Banner type="info" text="Nema podataka." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.pad}>
          {!!cancelM.error && <Banner type="error" text={cancelM.error} />}

          <View style={s.card}>
            <Text style={s.cardTitle}>Podaci</Text>

            <View style={s.kvRow}>
              <Text style={s.k}>Dokument</Text>
              <Text style={s.v}>{String(header?.documentName ?? header?.displayName ?? header?.documentCode ?? "")}</Text>
            </View>

            <View style={s.kvRow}>
              <Text style={s.k}>Broj</Text>
              <Text style={s.v}>{String(header?.documentBr ?? "")}</Text>
            </View>

            <View style={s.kvRow}>
              <Text style={s.k}>Datum</Text>
              <Text style={s.v}>{fmtHrDate(header?.documentDate ?? header?.bookedAt)}</Text>
            </View>

            <View style={s.kvRow}>
              <Text style={s.k}>Partner</Text>
              <Text style={s.v}>{partnerName || partnerId ? `${partnerName || "Partner"}${partnerId ? ` (#${partnerId})` : ""}` : "—"}</Text>
            </View>

            <View style={s.kvRow}>
              <Text style={s.k}>Status</Text>
              <Text style={s.v}>{st}</Text>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Stavke ({lines.length})</Text>

            {lines.length === 0 ? (
              <Text style={s.empty}>Nema stavki.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {lines.map((ln: any, idx: number) => {
                  const key = String(ln?.itemRowId ?? ln?.id ?? ln?.itemId ?? `${idx}`);
                  const name = String(ln?.name ?? "");
                  const code = String(ln?.itemCode ?? "");
                  const qty = String(ln?.quantity ?? "");
                  const unit = String(ln?.unit ?? "");

                  return (
                    <View key={key} style={s.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.lineTitle} numberOfLines={2}>
                          {name || "Stavka"}
                        </Text>
                        <Text style={s.lineSub} numberOfLines={2}>
                          {code ? `Šifra: ${code}` : ""}
                          {code && unit ? " • " : ""}
                          {unit ? `JMJ: ${unit}` : ""}
                        </Text>
                      </View>
                      <Text style={s.qty}>{qty}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Storno / Cancel</Text>

            <Text style={s.note}>
              Backend će:
              {"\n"}• ako je FINAL (posted) → pozvati storno proceduru
              {"\n"}• ako je DRAFT → obrisati draft (delete)
            </Text>

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
              {cancelM.loading ? <ActivityIndicator /> : <Text style={s.dangerTextBtn}>{st === "DRAFT" ? "Obriši draft" : "Storniraj dokument"}</Text>}
            </Pressable>
          </View>

          <Pressable style={s.secondary} onPress={() => router.back()}>
            <Text style={s.secondaryText}>Nazad</Text>
          </Pressable>
        </ScrollView>
      )}
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

  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    padding: 12,
    gap: 10,
  },
  cardTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  kvRow: { flexDirection: "row", gap: 10 },
  k: { width: 90, color: Colors.sub, fontWeight: "900", fontSize: 12 },
  v: { flex: 1, color: Colors.text, fontWeight: "900", fontSize: 12 },

  empty: { color: Colors.sub, fontWeight: "800", paddingVertical: 6 },

  lineRow: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  lineTitle: { fontWeight: "900", color: Colors.text, fontSize: 13, lineHeight: 17 },
  lineSub: { marginTop: 2, fontWeight: "800", color: Colors.sub, fontSize: 12 },
  qty: { fontWeight: "900", color: Colors.text, fontSize: 14 },

  note: { color: Colors.sub, fontWeight: "800", lineHeight: 18 },

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

  secondary: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.18)",
    alignItems: "center",
  },
  secondaryText: { fontWeight: "900", color: Colors.text },
});
