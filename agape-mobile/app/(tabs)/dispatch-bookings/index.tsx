// app/dispatch-bookings/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { Banner } from "@/components/Banner";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { DateRangeSheet } from "@/components/DateRangeSheet";

import { useCurrentUser } from "@/app/api/hooks/useCurrentUser";
import { useDispatchBookings, type DispatchBookingStatusFilter } from "@/app/api/hooks/useDispatchBookings";
import { documentDirectoryService } from "@/app/api/services/documentDirectoryService";

import type { DocumentDescriptorResponseDTO, DispatchBookingListItemDTO } from "@/app/models/generated";

function isBlank(s?: string | null) {
  return !s || !String(s).trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtHrDateFromIso(iso?: string | null): string {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
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

function statusPillStyle(st: ReturnType<typeof statusOfRow>) {
  if (st === "CANCELLED") return { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.28)", tx: Colors.dangerText ?? "#ef4444" };
  if (st === "FINAL") return { bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.30)", tx: Colors.text };
  return { bg: "rgba(59,130,246,0.10)", bd: "rgba(59,130,246,0.22)", tx: Colors.text };
}

export default function DispatchBookingsIndex() {
  const { session, ready } = useCurrentUser();
  const warehouseId = session?.defaultWarehouseId ?? null;

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [status, setStatus] = useState<DispatchBookingStatusFilter>("ALL");

  const [documentCode, setDocumentCode] = useState<string>("OTPREMNICA");
  const [pickedDoc, setPickedDoc] = useState<DocumentDescriptorResponseDTO | null>(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  // ✅ DEFAULT: NO date filter
  const [dateFromIso, setDateFromIso] = useState<string | null>(null);
  const [dateToIso, setDateToIso] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listQ = useDispatchBookings({
    warehouseId: warehouseId ? Number(warehouseId) : null,
    documentCode: pickedDoc?.documentCode ?? documentCode,
    status,
    q: debouncedQ || undefined,
    dateFrom: dateFromIso || undefined,
    dateTo: dateToIso || undefined,
    size: 20,
  });

  const topInfo = useMemo(() => {
    const dc = pickedDoc?.documentCode ?? documentCode;
    const dn = pickedDoc?.displayName ?? (dc === "OTPREMNICA" ? "Otpremnica" : dc);
    return { dc, dn };
  }, [pickedDoc, documentCode]);

  const fetchDocTypesPage = async ({ page, size, q }: { page: number; size: number; q?: string }) => {
    if (!warehouseId) return { items: [] as DocumentDescriptorResponseDTO[], page, size, total: 0 };

    const all = await documentDirectoryService.listDocTypesByCode(
      { warehouseId: Number(warehouseId), documentCode: "OTPREMNICA", q: q ?? undefined },
      undefined
    );

    const needle = (q ?? "").trim().toLowerCase();
    const filtered = !needle
      ? all
      : all.filter((d) => {
          const a = (d.displayName ?? "").toLowerCase();
          const b = (d.documentCode ?? "").toLowerCase();
          const c = String(d.documentId ?? "");
          return a.includes(needle) || b.includes(needle) || c.includes(needle);
        });

    filtered.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", "hr", { sensitivity: "base" }));

    const start = page * size;
    const end = start + size;
    return { items: filtered.slice(start, end), page, size, total: filtered.length };
  };

  const dateActive = !!dateFromIso && !!dateToIso;
  const dateLabel = useMemo(() => {
    if (!dateActive) return "Period";
    return `${fmtHrDateFromIso(dateFromIso)} → ${fmtHrDateFromIso(dateToIso)}`;
  }, [dateActive, dateFromIso, dateToIso]);

  if (!ready) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <View style={s.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!warehouseId) {
    return (
      <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
        <View style={s.pad}>
          <Banner type="error" text="Nema defaultWarehouseId u sesiji. Postavi glavno skladište u postavkama." />
        </View>
      </Screen>
    );
  }

  return (
    // no TOP safe-area padding
    <Screen style={{ backgroundColor: Colors.bg }} edges={["left", "right"]}>
      <View style={s.pad}>
        <Text style={s.h1}>Knjigovanja</Text>

        <View style={s.searchWrap}>
          <FontAwesome name="search" size={14} color={Colors.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pretraži partner (naziv ili ID)…"
            placeholderTextColor={Colors.sub}
            style={s.search}
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

        <View style={s.filtersRow}>
          <Pressable style={s.filterPill} onPress={() => setDocPickerOpen(true)}>
            <FontAwesome name="file-text-o" size={14} color={Colors.text} />
            <Text style={s.filterText} numberOfLines={1}>
              {pickedDoc?.displayName ?? "Odaberi dokument"}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.sub} />
          </Pressable>

          <Pressable
            style={[s.filterPill, dateActive && s.filterPillActive]}
            onPress={() => setDateOpen(true)}
          >
            <FontAwesome name="calendar" size={14} color={Colors.text} />
            <Text style={s.filterText}>{dateLabel}</Text>
            {dateActive && (
              <Pressable
                onPress={(e: any) => {
                  // stop row press
                  e?.stopPropagation?.();
                  setDateFromIso(null);
                  setDateToIso(null);
                }}
                hitSlop={8}
              >
                <FontAwesome name="times-circle" size={16} color={Colors.sub} />
              </Pressable>
            )}
          </Pressable>
        </View>

        <View style={s.segment}>
          {(["ALL", "FINAL", "DRAFT"] as DispatchBookingStatusFilter[]).map((k) => {
            const active = status === k;
            const label = k === "ALL" ? "Sve" : k === "FINAL" ? "Final" : "Draft";
            return (
              <Pressable key={k} style={[s.segBtn, active && s.segBtnActive]} onPress={() => setStatus(k)}>
                <Text style={[s.segText, active && s.segTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!!listQ.error && <Banner type="error" text={listQ.error} />}
      </View>

      {listQ.loading ? (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Učitavam…</Text>
        </View>
      ) : (
        <FlatList
          data={listQ.items as DispatchBookingListItemDTO[]}
          keyExtractor={(it) => String((it as any)?.headerId ?? (it as any)?.id ?? Math.random())}
          contentContainerStyle={s.list}
          onEndReachedThreshold={0.35}
          onEndReached={listQ.loadMore}
          renderItem={({ item }) => {
            const st = statusOfRow(item as any);
            const tone = statusPillStyle(st);

            const code = String((item as any)?.documentCode ?? "");
            const name = String((item as any)?.documentName ?? "");
            const br = String((item as any)?.documentBr ?? "");
            const bookedAtIso = String((item as any)?.bookedAt ?? (item as any)?.documentDate ?? "").slice(0, 10);
            const dt = fmtHrDateFromIso(bookedAtIso);

            const partnerName = String((item as any)?.partnerName ?? "");
            const partnerId = (item as any)?.partnerId != null ? String((item as any)?.partnerId) : "";

            const title = name || code || "Dokument";
            const sub = [
              code ? `Šifra: ${code}` : null,
              br ? `Br: ${br}` : null,
              dt ? `Datum: ${dt}` : null,
              partnerName ? `Partner: ${partnerName}${partnerId ? ` (#${partnerId})` : ""}` : partnerId ? `Partner #${partnerId}` : null,
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <Pressable
                style={s.row}
                onPress={() => {
                  const id = Number((item as any)?.headerId ?? (item as any)?.id);
                  if (!Number.isFinite(id)) return;
                  router.push({ pathname: "/dispatch-bookings/[id]", params: { id: String(id) } });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  {!!sub && (
                    <Text style={s.rowSub} numberOfLines={3}>
                      {sub}
                    </Text>
                  )}
                </View>

                <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
                  <Text style={[s.badgeText, { color: tone.tx }]}>{st}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>Nema rezultata.</Text>}
          ListFooterComponent={
            listQ.loadingMore ? (
              <View style={{ paddingVertical: 14 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}

      <SearchPickerSheet<DocumentDescriptorResponseDTO>
        visible={docPickerOpen}
        title="Odaberi dokument"
        onClose={() => setDocPickerOpen(false)}
        keyOf={(x) => String(x.documentId)}
        fetchPage={fetchDocTypesPage}
        renderRow={(d, close) => (
          <Pressable
            style={s.pickRow}
            onPress={() => {
              setPickedDoc(d);
              setDocumentCode(d.documentCode ?? "OTPREMNICA");
              close();
            }}
          >
            <Text style={s.pickTitle}>{d.displayName}</Text>
            <Text style={s.pickSub}>
              Šifra: {d.documentCode} • ID: {d.documentId} • Skladište: {String(warehouseId)}
            </Text>
          </Pressable>
        )}
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

const s = StyleSheet.create({
  pad: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, gap: 10 },
  h1: { fontWeight: "900", color: Colors.text, fontSize: 18 },
  h2: { fontWeight: "800", color: Colors.sub, fontSize: 12 },

  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: { flex: 1, fontWeight: "800", color: Colors.text },

  filtersRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  filterPill: {
    flexGrow: 1,
    minWidth: 170,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: "rgba(148,163,184,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterPillActive: { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.25)" },
  filterText: { flex: 1, fontWeight: "900", color: Colors.text, fontSize: 12 },

  segment: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  segBtnActive: { backgroundColor: "rgba(249,115,22,0.14)" },
  segText: { fontWeight: "900", color: Colors.sub, fontSize: 12 },
  segTextActive: { color: Colors.text },

  list: { paddingHorizontal: 14, paddingBottom: 18, gap: 10 },
  row: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rowTitle: { fontWeight: "900", color: Colors.text, fontSize: 14, lineHeight: 18 },
  rowSub: { marginTop: 4, fontWeight: "800", color: Colors.sub, fontSize: 12 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontWeight: "900", fontSize: 11 },

  empty: { textAlign: "center", color: Colors.sub, fontWeight: "800", paddingVertical: 18 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  muted: { color: Colors.sub, fontWeight: "800" },

  pickRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    gap: 4,
  },
  pickTitle: { fontWeight: "900", color: Colors.text, fontSize: 14 },
  pickSub: { fontWeight: "800", color: Colors.sub, fontSize: 12 },
});
