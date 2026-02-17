import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toUserMessage } from "@/app/api/apiClient";
import type { DispatchBookingListItemDTO, PagedResultDTO } from "@/app/models/generated";
import { dispatchBookingService } from "../services/dispatchBookingService";

export type DispatchBookingStatusFilter = "ALL" | "DRAFT" | "FINAL" | "CANCELLED";

type Args = {
  warehouseId: number | null; 
  documentCode?: string;
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

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const canLoad = useMemo(() => true, []);
  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);
  const ctrlRef = useRef<AbortController | null>(null);

  const clearStatus = useCallback(() => {
    setError(null);
    setLoadMoreError(null);
  }, []);

  const loadPage = useCallback(
    async (p: number, append: boolean) => {
      const rid = ++reqIdRef.current;

      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      try {
        if (append) {
          setLoadingMore(true);
          setLoadMoreError(null);
        } else {
          setLoading(true);
          setError(null);
          setLoadMoreError(null);
        }

        const res: PagedResultDTO<DispatchBookingListItemDTO> = await dispatchBookingService.page(
          {
            warehouseId,
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

        if (!append) setError(null);
      } catch (e: any) {
        if (!mountedRef.current || rid !== reqIdRef.current) return;
        const msg = toUserMessage(e, "Greška prilikom učitavanja.");

        if (append) {
          setLoadMoreError(msg);
        } else {
          setError(msg);
        }
      } finally {
        if (!mountedRef.current || rid !== reqIdRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [warehouseId, size, documentCode, status, q, dateFrom, dateTo]
  );

  const refresh = useCallback(async () => {
    setItems([]);
    setPage(0);
    setTotal(0);
    await loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (!canLoadMore) return;
    await loadPage(page + 1, true);
  }, [loading, loadingMore, canLoadMore, loadPage, page]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ctrlRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!canLoad) return;
    refresh();
  }, [warehouseId, documentCode, status, q, dateFrom, dateTo, size]);

  return {
    items,
    page,
    size,
    total,

    loading,
    loadingMore,

    error, 
    loadMoreError,

    canLoad,
    canLoadMore,

    refresh,
    loadMore,

    clearStatus,
    setItems,
    setError, 
  };
}
