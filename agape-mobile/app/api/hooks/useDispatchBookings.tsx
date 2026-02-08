import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/app/api/apiClient";
import type { DispatchBookingListItemDTO, PagedResultDTO } from "@/app/models/generated";
import { dispatchBookingService } from "../services/dispatchBookingService";

export type DispatchBookingStatusFilter = "ALL" | "DRAFT" | "FINAL" | "CANCELLED";

type Args = {
  warehouseId: number | null;     // null => ALL
  documentCode?: string;          // default OTPREMNICA
  status?: DispatchBookingStatusFilter;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  size?: number;
};

export function useDispatchBookings(args: Args) {
  const { warehouseId, documentCode = "OTPREMNICA", status = "ALL", q, dateFrom, dateTo, size = 20 } = args;

  const [items, setItems] = useState<DispatchBookingListItemDTO[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ ALWAYS can load (warehouseId can be null => ALL)
  const canLoad = useMemo(() => true, []);
  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);

  const loadPage = async (p: number, append: boolean) => {
    const rid = ++reqIdRef.current;
    const ctrl = new AbortController();

    try {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }

      const res: PagedResultDTO<DispatchBookingListItemDTO> = await dispatchBookingService.page(
        {
          warehouseId, // ✅ can be null -> service omits param
          page: p,
          size,
          documentCode,
          status,
          q: q?.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        ctrl.signal
      );

      if (!mountedRef.current || rid !== reqIdRef.current) return;

      setPage(res.page ?? p);
      setTotal(Number(res.total ?? 0));

      const next = (res.items ?? []) as DispatchBookingListItemDTO[];
      setItems((prev) => (append ? [...prev, ...next] : next));
    } catch (e: any) {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      if (e instanceof ApiError) setError((e.body as any)?.message || e.message);
      else setError(e?.message || "Greška prilikom učitavanja.");
    } finally {
      if (!mountedRef.current || rid !== reqIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    }

    return () => ctrl.abort();
  };

  const refresh = async () => {
    setItems([]);
    setPage(0);
    setTotal(0);
    await loadPage(0, false);
  };

  const loadMore = async () => {
    if (loading || loadingMore) return;
    if (!canLoadMore) return;
    await loadPage(page + 1, true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canLoad) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, documentCode, status, q, dateFrom, dateTo, size]);

  return { items, page, size, total, loading, loadingMore, error, canLoad, refresh, loadMore, setItems, setError };
}
