import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { DateRangeSheet } from "@/components/DateRangeSheet";

import { useCurrentUser } from "@/app/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "@/app/api/hooks/common/usePullToRefresh";
import { useDispatchBookings } from "@/app/api/hooks/useDispatchBookings";
import { useWarehouses } from "@/app/api/hooks/dashboard/useWarehouses";
import { documentDirectoryService } from "@/app/api/services/documentDirectoryService";
import { toUserMessage } from "@/app/api/apiClient";

import type { DocumentDescriptorResponseDTO, DispatchBookingListItemDTO } from "@/app/models/generated";
import { styles as s } from "./styles/DispatchBookingsIndex.styles";
import { fmtHrFromIso } from "@/app/utils/dateIso";

type DispatchBookingStatusFilter = "ALL" | "FINAL" | "DRAFT" | "CANCELLED";
type WarehousePick = { id: number | null; label: string };

const STATUS_KEYS: DispatchBookingStatusFilter[] = ["ALL", "FINAL", "DRAFT", "CANCELLED"];

function statusOfRow(d: any): "DRAFT" | "FINAL" | "CANCELLED" {
  if (d?.cancelled === true || d?.storno === 1) return "CANCELLED";
  if (d?.posted === true || d?.knjizeno === 1) return "FINAL";
  return "DRAFT";
}

function statusPillStyle(st: ReturnType<typeof statusOfRow>) {
  if (st === "CANCELLED")
    return { bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.28)", tx: Colors.dangerText ?? "#ef4444" };
  if (st === "FINAL") return { bg: "rgba(34,197,94,0.14)", bd: "rgba(34,197,94,0.30)", tx: Colors.text };
  return { bg: "rgba(59,130,246,0.10)", bd: "rgba(59,130,246,0.22)", tx: Colors.text };
}

function statusLabel(k: DispatchBookingStatusFilter) {
  if (k === "ALL") return "Sve";
  if (k === "FINAL") return "Final";
  if (k === "DRAFT") return "Draft";
  return "Storno";
}

function buildRowSubLines(item: any): string[] {
  const code = String(item?.documentCode ?? "").trim();
  const br = String(item?.documentBr ?? "").trim();

  const bookedAtIso = String(item?.bookedAt ?? item?.documentDate ?? "").slice(0, 10);
  const dt = fmtHrFromIso(bookedAtIso);

  const partnerName = String(item?.partnerName ?? "").trim();
  const partnerId = item?.partnerId != null ? String(item.partnerId).trim() : "";

  const line1 = [code ? `Šifra: ${code}` : null, dt ? `Datum: ${dt}` : null].filter(Boolean).join(" • ");
  const line2 = br ? `Dokument Br: ${br}` : "";
  const line3 = partnerName
    ? `Partner: ${partnerName}${partnerId ? ` (#${partnerId})` : ""}`
    : partnerId
      ? `Partner (#${partnerId})`
      : "";

  return [line1, line2, line3].filter(Boolean);
}

export default function DispatchBookingsIndex() {
  const { session, ready } = useCurrentUser();
  const defaultWhId = session?.defaultWarehouseId != null ? Number(session.defaultWarehouseId) : null;

  const whQ = useWarehouses() as any;
  const warehouses: number[] = (whQ?.data ?? []) as any;
  const whLoading = !!whQ?.isLoading;
  const whError = whQ?.error;
  const refetchWarehouses = whQ?.refetch;

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [status, setStatus] = useState<DispatchBookingStatusFilter>("ALL");

  const [documentCode, setDocumentCode] = useState<string>("OTPREMNICA");
  const [pickedDoc, setPickedDoc] = useState<DocumentDescriptorResponseDTO | null>(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const [dateFromIso, setDateFromIso] = useState<string | null>(null);
  const [dateToIso, setDateToIso] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listQ = useDispatchBookings({
    warehouseId,
    documentCode: pickedDoc?.documentCode ?? documentCode,
    status: status as any,
    q: debouncedQ || undefined,
    dateFrom: dateFromIso || undefined,
    dateTo: dateToIso || undefined,
    size: 20,
  }) as any;

  const listData: DispatchBookingListItemDTO[] = useMemo(() => {
    return ((listQ?.items as DispatchBookingListItemDTO[]) ?? []) as DispatchBookingListItemDTO[];
  }, [listQ?.items]);

  const listHasData = listData.length > 0;

  const listErrorMessage = useMemo(() => {
    if (!listQ?.error) return null;
    if (listHasData) return null;
    return String(listQ.error);
  }, [listQ?.error, listHasData]);

  const whErrorMessage = useMemo(() => {
    if (!whError) return null;
    if ((warehouses?.length ?? 0) > 0) return null;
    return typeof whError === "string" ? whError : toUserMessage(whError, "Greška prilikom učitavanja.");
  }, [whError, warehouses?.length]);

  const topError = useMemo(() => listErrorMessage || whErrorMessage || null, [listErrorMessage, whErrorMessage]);

  const topErrorActionText = useMemo(() => (topError ? "Pokušaj ponovno" : "Zatvori"), [topError]);

  const closePickers = useCallback(() => {
    setWarehouseOpen(false);
    setDocPickerOpen(false);
    setDateOpen(false);
  }, []);

  useEffect(() => {
    if (!listHasData) return;
    if (!listQ?.error) return;
    listQ?.clearStatus?.();
  }, [listHasData, listQ?.error]);

  const onTopErrorAction = useCallback(() => {
    if (!topError) return;

    closePickers();

    listQ?.clearStatus?.();

    const jobs: Promise<any>[] = [];
    if (listErrorMessage) jobs.push(Promise.resolve(listQ?.refresh?.()));
    if (whErrorMessage) jobs.push(Promise.resolve(refetchWarehouses?.()));

    if (!jobs.length) {
      jobs.push(Promise.resolve(refetchWarehouses?.()));
      jobs.push(Promise.resolve(listQ?.refresh?.()));
    }

    return Promise.all(jobs);
  }, [topError, closePickers, listErrorMessage, whErrorMessage, listQ, refetchWarehouses]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      closePickers();
      listQ?.clearStatus?.();
      await Promise.all([Promise.resolve(refetchWarehouses?.()), Promise.resolve(listQ?.refresh?.())]);
    },
  ]);

  const dateActive = !!dateFromIso && !!dateToIso;

  const dateLabel = useMemo(() => {
    if (!dateActive) return "Datum";
    return `${fmtHrFromIso(dateFromIso)} → ${fmtHrFromIso(dateToIso)}`;
  }, [dateActive, dateFromIso, dateToIso]);

  const warehouseLabel = useMemo(() => {
    if (warehouseId == null) return "Sva skladišta";
    return `Skladište #${warehouseId}`;
  }, [warehouseId]);

  const fetchWarehousesPage = async ({ page, size, q }: { page: number; size: number; q?: string }) => {
    const needle = (q ?? "").trim().toLowerCase();
    const base: WarehousePick[] = [{ id: null, label: "Sva skladišta" }];

    const list: WarehousePick[] = (warehouses ?? []).map((id) => ({
      id: Number(id),
      label: `Skladište #${Number(id)}`,
    }));

    const filtered = !needle
      ? list
      : list.filter((w) => w.label.toLowerCase().includes(needle) || String(w.id ?? "").includes(needle));

    const items = base.concat(filtered);
    const start = page * size;
    const end = start + size;

    return { items: items.slice(start, end), page, size, total: items.length };
  };

  const fetchDocTypesPage = async ({ page, size, q }: { page: number; size: number; q?: string }) => {
    const whForDocs = warehouseId ?? defaultWhId;
    if (!whForDocs) return { items: [] as DocumentDescriptorResponseDTO[], page, size, total: 0 };

    const all = await documentDirectoryService.listDocTypesByCode(
      { warehouseId: Number(whForDocs), documentCode: "OTPREMNICA", q: q ?? undefined },
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

  if (!ready) {
    return (
      <Screen style={s.screen} edges={["left", "right"]}>
        <View style={s.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const showFullScreenLoading = !!listQ?.loading && listData.length === 0 && !refreshing;

  return (
    <Screen style={s.screen} edges={["left", "right"]}>
      <View style={s.pad}>
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
          <Pressable style={s.filterPill} onPress={() => setWarehouseOpen(true)}>
            <FontAwesome name="building" size={14} color={Colors.text} />
            <Text style={s.filterText} numberOfLines={1}>
              {warehouseLabel}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.sub} />
          </Pressable>

          <Pressable style={s.filterPill} onPress={() => setDocPickerOpen(true)}>
            <FontAwesome name="file-text-o" size={14} color={Colors.text} />
            <Text style={s.filterText} numberOfLines={1}>
              {pickedDoc?.displayName ?? "Odaberi dokument"}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.sub} />
          </Pressable>

          <Pressable style={[s.filterPill, dateActive && s.filterPillActive]} onPress={() => setDateOpen(true)}>
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

        <View style={s.segment}>
          {STATUS_KEYS.map((k) => {
            const active = status === k;
            return (
              <Pressable key={k} style={[s.segBtn, active && s.segBtnActive]} onPress={() => setStatus(k)}>
                <Text style={[s.segText, active && s.segTextActive]}>{statusLabel(k)}</Text>
              </Pressable>
            );
          })}
        </View>

        {!!topError ? (
          <View style={s.topErrorWrap}>
            <ErrorCard
              title="Greška"
              message={topError}
              actionText={topErrorActionText}
              onAction={onTopErrorAction}
              titleLines={1}
              messageLines={2}
            />
          </View>
        ) : null}
      </View>

      {showFullScreenLoading ? (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.muted}>Učitavam…</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(it) => String((it as any)?.headerId ?? (it as any)?.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.35}
          onEndReached={() => listQ?.loadMore?.()}
          renderItem={({ item }) => {
            const st = statusOfRow(item as any);
            const tone = statusPillStyle(st);

            const title = String((item as any)?.documentName ?? (item as any)?.documentCode ?? "Dokument");
            const subLines = buildRowSubLines(item);

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

                  {subLines.length ? (
                    <View style={{ marginTop: 4, gap: 2 }}>
                      {subLines.map((line, idx) => (
                        <Text key={idx} style={s.rowSub} numberOfLines={1}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={[s.badge, { backgroundColor: tone.bg, borderColor: tone.bd }]}>
                  <Text style={[s.badgeText, { color: tone.tx }]}>{st === "CANCELLED" ? "STORNO" : st}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={listErrorMessage ? null : <Text style={s.empty}>Nema rezultata.</Text>}
          ListFooterComponent={
            listQ?.loadingMore ? (
              <View style={s.footerLoading}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}

      <SearchPickerSheet<WarehousePick>
        visible={warehouseOpen}
        title="Skladište"
        onClose={() => setWarehouseOpen(false)}
        keyOf={(x) => String(x.id ?? "ALL")}
        fetchPage={fetchWarehousesPage}
        renderRow={(w, close) => (
          <Pressable
            style={s.pickRow}
            onPress={() => {
              setWarehouseId(w.id);
              close();
            }}
          >
            <Text style={s.pickTitle}>{w.label}</Text>
            <Text style={s.pickSub}>{w.id == null ? "Prikaz svih skladišta" : `ID: ${w.id}`}</Text>
          </Pressable>
        )}
      />

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
              Šifra: {d.documentCode} • ID: {d.documentId}
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
