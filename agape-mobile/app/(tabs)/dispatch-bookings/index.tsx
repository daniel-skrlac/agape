import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";

import Screen from "@/components/ui/Screen";
import Colors from "@/src/constants/Colors";
import { ErrorCard } from "@/components/ErrorCard";
import { SearchPickerSheet } from "@/components/SearchPickerSheet";
import { DateRangeSheet } from "@/components/DateRangeSheet";
import InfoResultPopup from "@/components/InfoResultPopup";

import { useCurrentUser } from "../../../src/api/hooks/common/useCurrentUser";
import { usePullToRefresh } from "../../../src/api/hooks/common/usePullToRefresh";
import { useDispatchBookings } from "../../../src/api/hooks/dispatch-bookings/useDispatchBookings";
import { useWarehouses } from "../../../src/api/hooks/dashboard/useWarehouses";
import { documentDirectoryService } from "../../../src/api/services/documentDirectoryService";
import { toUserMessage } from "../../../src/api/apiClient";

import type {
  DocumentDescriptorResponseDTO,
  DispatchBookingListItemDTO,
} from "@/src/models/generated";
import { styles as s } from "../../../src/styles/DispatchBookingsIndex.styles";
import { fmtHrFromIso } from "@/src/utils/dateIso";

type DispatchBookingStatusFilter = "ALL" | "FINAL" | "DRAFT" | "CANCELLED";
type WarehousePick = { id: number | null; label: string };

type ResultPopupState = {
  visible: boolean;
  kind: "success" | "error" | "info";
  title: string;
  message: string;
  linkHeaderId?: number | null;
};

const STATUS_KEYS: DispatchBookingStatusFilter[] = ["ALL", "FINAL", "DRAFT", "CANCELLED"];

function parseStatusParam(v: string | string[] | undefined): DispatchBookingStatusFilter | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;

  const x = String(raw).toUpperCase().trim();
  if (x === "ALL" || x === "FINAL" || x === "DRAFT" || x === "CANCELLED") return x;

  return null;
}

function parseResultParam(v: string | string[] | undefined): "STORNO_OK" | "DRAFT_DELETED" | "POST_OK" | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;

  const x = String(raw).toUpperCase().trim();
  if (x === "STORNO_OK") return "STORNO_OK";
  if (x === "DRAFT_DELETED") return "DRAFT_DELETED";
  if (x === "POST_OK") return "POST_OK";
  return null;
}

function parseIntParam(v: string | string[] | undefined): number | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseTextParam(v: string | string[] | undefined): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return null;
  const x = String(raw);
  return x.trim() ? x : null;
}

function statusOfRow(d: any): "DRAFT" | "FINAL" | "CANCELLED" {
  if (d?.cancelled === true || d?.storno === 1) return "CANCELLED";
  if (d?.posted === true || d?.knjizeno === 1) return "FINAL";
  return "DRAFT";
}

function statusPillStyle(st: ReturnType<typeof statusOfRow>) {
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

function statusLabel(k: DispatchBookingStatusFilter) {
  if (k === "ALL") return "Sve";
  if (k === "FINAL") return "Final";
  if (k === "DRAFT") return "Draft";
  return "Storno";
}

function documentGroupRank(doc: DocumentDescriptorResponseDTO | null | undefined): number {
  const text = `${(doc as any)?.storageGroupName ?? ""} ${(doc as any)?.displayName ?? ""}`.toLowerCase();
  if (text.includes("socijalna")) return 0;
  if (text.includes("doniran")) return 1;
  return 2;
}

function compareDocuments(a: DocumentDescriptorResponseDTO, b: DocumentDescriptorResponseDTO): number {
  const rank = documentGroupRank(a) - documentGroupRank(b);
  if (rank !== 0) return rank;

  const name = String((a as any)?.storageGroupName ?? a.displayName ?? "").localeCompare(
    String((b as any)?.storageGroupName ?? b.displayName ?? ""),
    "hr",
    { sensitivity: "base" }
  );
  if (name !== 0) return name;

  const aw = Number((a as any)?.warehouseId ?? 0);
  const bw = Number((b as any)?.warehouseId ?? 0);
  if (aw !== bw) return aw - bw;

  return Number((a as any)?.documentId ?? 0) - Number((b as any)?.documentId ?? 0);
}

function buildRowSubLines(item: any): string[] {
  const code = String(item?.documentCode ?? "").trim();
  const br = String(item?.documentBr ?? "").trim();
  const bookedAtIso = String(item?.bookedAt ?? item?.documentDate ?? "").slice(0, 10);
  const dt = fmtHrFromIso(bookedAtIso);

  const partnerName = String(item?.partnerName ?? "").trim();
  const partnerId = item?.partnerId != null ? String(item.partnerId).trim() : "";

  const line1 = [code ? `Šifra: ${code}` : null, dt ? `Datum: ${dt}` : null]
    .filter(Boolean)
    .join(" • ");
  const line2 = br ? `Dokument Br: ${br}` : "";
  const line3 = partnerName
    ? `Partner: ${partnerName}${partnerId ? ` (#${partnerId})` : ""}`
    : partnerId
      ? `Partner (#${partnerId})`
      : "";

  return [line1, line2, line3].filter(Boolean);
}

export default function DispatchBookingsIndex() {
  const routeParams = useLocalSearchParams<{
    status?: string | string[];
    _r?: string | string[];
    result?: string | string[];
    resultHeaderId?: string | string[];
    resultMessage?: string | string[];
  }>();

  const routeStatus = parseStatusParam(routeParams.status);
  const routeRefreshToken = Array.isArray(routeParams._r) ? routeParams._r[0] : routeParams._r;
  const routeResult = parseResultParam(routeParams.result);
  const routeResultHeaderId = parseIntParam(routeParams.resultHeaderId);
  const routeResultMessage = parseTextParam(routeParams.resultMessage);

  const { ready } = useCurrentUser();

  const whQ = useWarehouses() as any;
  const warehouses: number[] = (whQ?.data ?? []) as any;
  const whError = whQ?.error;
  const refetchWarehouses = whQ?.refetch;

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [warehouseOpen, setWarehouseOpen] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [status, setStatus] = useState<DispatchBookingStatusFilter>(routeStatus ?? "ALL");

  const [documentCode, setDocumentCode] = useState<string>("OTPREMNICA");
  const [pickedDoc, setPickedDoc] = useState<DocumentDescriptorResponseDTO | null>(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  const [dateFromIso, setDateFromIso] = useState<string | null>(null);
  const [dateToIso, setDateToIso] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const handledRouteEventRef = useRef<string | null>(null);

  const [resultPopup, setResultPopup] = useState<ResultPopupState>({
    visible: false,
    kind: "success",
    title: "",
    message: "",
    linkHeaderId: null,
  });

  const closeResultPopup = useCallback(() => {
    setResultPopup((prev) => ({ ...prev, visible: false }));
  }, []);

  const openResultDetails = useCallback(() => {
    const id = resultPopup.linkHeaderId;
    if (!id || !Number.isFinite(id)) return;

    closeResultPopup();

    const token = `${Date.now()}_${id}`;
    requestAnimationFrame(() => {
      try {
        router.push({
          pathname: "/(tabs)/dispatch-bookings/[id]",
          params: { id: String(id), _rf: token },
        } as any);
      } catch {
        try {
          (router as any).push?.(
            `/(tabs)/dispatch-bookings/${id}?_rf=${encodeURIComponent(token)}`
          );
        } catch { }
      }
    });
  }, [resultPopup.linkHeaderId, closeResultPopup]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!routeStatus) return;
    if (routeRefreshToken) return;
    setStatus(routeStatus);
  }, [routeStatus, routeRefreshToken]);

  const statusForApi = status === "ALL" ? undefined : status;

  const listQ = useDispatchBookings({
    warehouseId,
    documentCode: pickedDoc?.documentCode ?? documentCode,
    status: statusForApi as any,
    q: debouncedQ || undefined,
    dateFrom: dateFromIso || undefined,
    dateTo: dateToIso || undefined,
    size: 20,
  }) as any;

  const refreshList = useCallback(() => {
    const fn = listQ?.refresh ?? listQ?.refetch;
    return Promise.resolve(fn?.());
  }, [listQ]);

  const listData: DispatchBookingListItemDTO[] = useMemo(() => {
    return ((listQ?.items as DispatchBookingListItemDTO[]) ?? []) as DispatchBookingListItemDTO[];
  }, [listQ?.items]);

  const listHasData = listData.length > 0;

  const listErrorMessage = useMemo(() => {
    if (!listQ?.error) return null;
    if (listHasData) return null;
    return toUserMessage(listQ.error, "Greška prilikom učitavanja.");
  }, [listQ?.error, listHasData]);

  const whErrorMessage = useMemo(() => {
    if (!whError) return null;
    if ((warehouses?.length ?? 0) > 0) return null;
    return toUserMessage(whError, "Greška prilikom učitavanja skladišta.");
  }, [whError, warehouses?.length]);

  const topError = useMemo(
    () => listErrorMessage || whErrorMessage || null,
    [listErrorMessage, whErrorMessage]
  );

  const closePickers = useCallback(() => {
    setWarehouseOpen(false);
    setDocPickerOpen(false);
    setDateOpen(false);
  }, []);

  useEffect(() => {
    if (!listHasData) return;
    if (!listQ?.error) return;
    listQ?.clearStatus?.();
  }, [listHasData, listQ?.error, listQ]);

  useEffect(() => {
    if (!routeRefreshToken) return;

    const eventKey =
      `${routeRefreshToken}|${routeStatus ?? ""}|${routeResult ?? ""}|${routeResultHeaderId ?? ""}|${routeResultMessage ?? ""}`;
    if (handledRouteEventRef.current === eventKey) return;

    if (routeStatus && status !== routeStatus) {
      setStatus(routeStatus);
      return;
    }

    handledRouteEventRef.current = eventKey;

    closePickers();
    listQ?.clearStatus?.();
    refreshList().catch(() => { });

    if (routeResult === "DRAFT_DELETED") {
      setResultPopup({
        visible: true,
        kind: "success",
        title: "Draft obrisan",
        message: "Draft dokument je uspješno obrisan.",
        linkHeaderId: null,
      });
    }

    if (routeResult === "STORNO_OK") {
      setResultPopup({
        visible: true,
        kind: "success",
        title: "Storno uspješan",
        message: "Dokument je uspješno storniran.",
        linkHeaderId: routeResultHeaderId,
      });
    }

    if (routeResult === "POST_OK") {
      setResultPopup({
        visible: true,
        kind: "success",
        title: "Knjiženje uspješno",
        message: routeResultMessage ?? "Dokument je uspješno knjižen.",
        linkHeaderId: routeResultHeaderId,
      });
    }
  }, [
    routeRefreshToken,
    routeStatus,
    routeResult,
    routeResultHeaderId,
    routeResultMessage,
    status,
    closePickers,
    listQ,
    refreshList,
  ]);

  const onTopErrorAction = useCallback(() => {
    if (!topError) return;

    closePickers();
    listQ?.clearStatus?.();

    const jobs: Promise<any>[] = [];
    if (listErrorMessage) jobs.push(refreshList());
    if (whErrorMessage) jobs.push(Promise.resolve(refetchWarehouses?.()));

    if (!jobs.length) {
      jobs.push(Promise.resolve(refetchWarehouses?.()));
      jobs.push(refreshList());
    }

    return Promise.all(jobs);
  }, [
    topError,
    closePickers,
    listErrorMessage,
    whErrorMessage,
    listQ,
    refetchWarehouses,
    refreshList,
  ]);

  const { refreshing, onRefresh } = usePullToRefresh([
    async () => {
      closePickers();
      listQ?.clearStatus?.();
      await Promise.all([Promise.resolve(refetchWarehouses?.()), refreshList()]);
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

  const isBusy = !!listQ?.loading || !!listQ?.loadingMore || refreshing;
  const showInitialLoading = !listHasData && !!listQ?.loading && !refreshing && !topError;
  const showInlineLoading = listHasData && !!listQ?.loading && !refreshing;
  const showEmpty = !isBusy && !topError && !listErrorMessage && listData.length === 0;

  const warehousePickerKey = useMemo(
    () => ["dispatch-bookings", "warehouse-picker", (warehouses ?? []).join(",")] as const,
    [warehouses]
  );

  const documentPickerKey = useMemo(
    () =>
      [
        "dispatch-bookings",
        "document-picker",
        warehouseId ?? "ALL_WAREHOUSES",
        documentCode,
      ] as const,
    [warehouseId, documentCode]
  );

  const queryWarehousesPage = useCallback(
    async ({ page, size, q }: { page: number; size: number; q?: string; signal?: AbortSignal }) => {
      const needle = (q ?? "").trim().toLowerCase();
      const base: WarehousePick[] = [{ id: null, label: "Sva skladišta" }];

      const list: WarehousePick[] = (warehouses ?? []).map((id) => ({
        id: Number(id),
        label: `Skladište #${Number(id)}`,
      }));

      const filtered = !needle
        ? list
        : list.filter(
          (w) =>
            w.label.toLowerCase().includes(needle) ||
            String(w.id ?? "").includes(needle)
        );

      const items = base.concat(filtered);
      const start = page * size;
      const end = start + size;

      return {
        items: items.slice(start, end),
        page,
        size,
        total: items.length,
      };
    },
    [warehouses]
  );

  const queryDocTypesPage = useCallback(
    async ({
      page,
      size,
      q,
      signal,
    }: {
      page: number;
      size: number;
      q?: string;
      signal?: AbortSignal;
    }) => {
      const all = await documentDirectoryService.listDocTypesByCode(
        {
          warehouseId: warehouseId == null ? null : Number(warehouseId),
          documentCode: "OTPREMNICA",
          q: q ?? undefined,
        },
        signal
      );

      const needle = (q ?? "").trim().toLowerCase();

      const filtered = !needle
        ? all
        : all.filter((d) => {
          const a = (d.displayName ?? "").toLowerCase();
          const b = (d.documentCode ?? "").toLowerCase();
          const c = String(d.documentId ?? "");
          const group = String((d as any).storageGroupName ?? "").toLowerCase();
          return a.includes(needle) || b.includes(needle) || c.includes(needle) || group.includes(needle);
        });

      filtered.sort(compareDocuments);

      const start = page * size;
      const end = start + size;

      return {
        items: filtered.slice(start, end),
        page,
        size,
        total: filtered.length,
      };
    },
    [warehouseId]
  );

  if (!ready) {
    return (
      <Screen style={s.screen} edges={["left", "right"]}>
        <View style={s.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

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
              {String((pickedDoc as any)?.storageGroupName ?? "").trim() || pickedDoc?.displayName || "Odaberi dokument"}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Colors.sub} />
          </Pressable>

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
                onPressIn={(e) => (e as any)?.stopPropagation?.()}
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
              <Pressable
                key={k}
                style={[s.segBtn, active && s.segBtnActive]}
                onPress={() => setStatus(k)}
              >
                <Text style={[s.segText, active && s.segTextActive]}>{statusLabel(k)}</Text>
              </Pressable>
            );
          })}
        </View>

        {showInlineLoading ? (
          <View style={{ paddingTop: 8, alignItems: "center" }}>
            <ActivityIndicator size="small" />
          </View>
        ) : null}

        {!!topError ? (
          <View style={s.topErrorWrap}>
            <ErrorCard
              title="Greška"
              message={topError}
              actionText="Pokušaj ponovno"
              onAction={onTopErrorAction}
              titleLines={1}
              messageLines={2}
            />
          </View>
        ) : null}
      </View>

      {showInitialLoading ? (
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
          onEndReached={() => {
            if (listData.length === 0) return;
            if (listQ?.loading || listQ?.loadingMore || refreshing) return;
            listQ?.loadMore?.();
          }}
          renderItem={({ item }) => {
            const st = statusOfRow(item as any);
            const tone = statusPillStyle(st);
            const title = String(
              (item as any)?.documentName ?? (item as any)?.documentCode ?? "Dokument"
            );
            const subLines = buildRowSubLines(item);

            return (
              <Pressable
                style={s.row}
                onPress={() => {
                  const id = Number((item as any)?.headerId ?? (item as any)?.id);
                  if (!Number.isFinite(id)) return;

                  router.push({
                    pathname: "/(tabs)/dispatch-bookings/[id]",
                    params: { id: String(id) },
                  } as any);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={2}>
                    {title}
                  </Text>

                  {subLines.length > 0 ? (
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
                  <Text style={[s.badgeText, { color: tone.tx }]}>
                    {st === "CANCELLED" ? "STORNO" : st}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={showEmpty ? <Text style={s.empty}>Nema rezultata.</Text> : null}
          ListFooterComponent={
            listQ?.loadingMore && listData.length > 0 ? (
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
        queryKeyBase={warehousePickerKey}
        queryPage={queryWarehousesPage}
        renderRow={(w, close) => (
          <Pressable
            style={s.pickRow}
            onPress={() => {
              setWarehouseId(w.id);
              close();
            }}
          >
            <Text style={s.pickTitle}>{w.label}</Text>
            <Text style={s.pickSub}>
              {w.id == null ? "Prikaz svih skladišta" : `ID: ${w.id}`}
            </Text>
          </Pressable>
        )}
      />

      <SearchPickerSheet<DocumentDescriptorResponseDTO>
        visible={docPickerOpen}
        title="Odaberi dokument"
        onClose={() => setDocPickerOpen(false)}
        keyOf={(x) => String(x.documentId)}
        queryKeyBase={documentPickerKey}
        queryPage={queryDocTypesPage}
        renderRow={(d, close) => (
          <Pressable
            style={s.pickRow}
            onPress={() => {
              setPickedDoc(d);
              setDocumentCode(d.documentCode ?? "OTPREMNICA");
              close();
            }}
          >
            <Text style={s.pickTitle}>
              {String((d as any).storageGroupName ?? "").trim() || d.displayName}
            </Text>
            <Text style={s.pickSub}>
              Šifra: {d.documentCode} • Dokument #{d.documentId}
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

      <InfoResultPopup
        visible={resultPopup.visible}
        variant={resultPopup.kind}
        title={resultPopup.title}
        message={resultPopup.message}
        subtitle={
          resultPopup.kind === "success"
            ? "Možeš otvoriti dokument i provjeriti status."
            : undefined
        }
          linkText={
            resultPopup.linkHeaderId
              ? `Otvori otpremnicu #${resultPopup.linkHeaderId}`
              : undefined
          }
        onLinkPress={resultPopup.linkHeaderId ? openResultDetails : undefined}
        buttonText="U redu"
        onClose={closeResultPopup}
        closeOnBackdrop={false}
      />
    </Screen>
  );
}
