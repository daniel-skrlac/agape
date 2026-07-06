import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toUserMessage } from "../../../../src/api/apiClient";
import type { DispatchBookingListItemDTO, PagedResultDTO } from "@/src/models/generated";
import { dispatchBookingService } from "../../services/dispatchBookingService";
import Strings from "@/src/constants/Strings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../src/api/api";
import type {
  DispatchBookingDetailDTO,
  DispatchRequestValidationDTO,
  DispatchResponseDTO,
  DispatchUpdateRequestDTO,
} from "@/src/models/generated";


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

const paths = {
  detail: (id: number) => `/api/v1/dispatch/bookings/${id}`,
  validate: `/api/v1/dispatch/validate`,
  update: (id: number) => `/api/v1/dispatch-note/${id}`,
};

const qk = {
  detail: (id: number) => ["dispatchBookingDetail", id] as const,
};

export function useDispatchBookings(args: Args) {

  const { warehouseId, documentCode = "OTPREMNICA", status, q, dateFrom, dateTo, size = 20 } = args;

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

export function useDispatchBookingDetail(headerId: number | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: headerId ? qk.detail(headerId) : ["dispatchBookingDetail", "null"],
    enabled: !!headerId,
    queryFn: ({ signal }) =>
      api.request<DispatchBookingDetailDTO>(paths.detail(Number(headerId)), {
        signal,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      } as any),
  });

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    return toUserMessage(query.error, Strings.settings.errors.generic);
  }, [query.error]);

  const setBooking = (d: DispatchBookingDetailDTO) => {
    if (!headerId) return;
    qc.setQueryData(qk.detail(headerId), d);
  };

  const invalidate = async () => {
    if (!headerId) return;
    await qc.invalidateQueries({ queryKey: qk.detail(headerId) });
  };

  const fetchDetailNoCache = async () => {
    if (!headerId) return null;

    const url = `${paths.detail(Number(headerId))}?_ts=${Date.now()}`;

    const fresh = await api.request<DispatchBookingDetailDTO>(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    } as any);

    qc.setQueryData(qk.detail(headerId), fresh);
    return fresh;
  };

  const refetchFresh = async () => {
    if (!headerId) return null;

    await qc.cancelQueries({ queryKey: qk.detail(headerId) });
    await qc.invalidateQueries({ queryKey: qk.detail(headerId) });

    return await fetchDetailNoCache();
  };

  return {
    headerId,
    booking: query.data ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    errorMessage,
    refetch: query.refetch,
    refetchFresh,
    fetchDetailNoCache,
    invalidate,
    setBooking,
  };
}

export function useDispatchBookingValidate() {
  const mutation = useMutation({
    mutationFn: (payload: DispatchRequestValidationDTO) =>
      api.request<any>(paths.validate, { method: "POST", body: payload, timeoutMs: 60_000 } as any),
  });

  const errorMessage = useMemo(() => {
    if (!mutation.error) return null;
    return toUserMessage(mutation.error, Strings.settings.errors.generic);
  }, [mutation.error]);

  return {
    validate: mutation.mutateAsync,
    reset: mutation.reset,
    data: mutation.data ?? null,
    loading: mutation.isPending,
    errorMessage,
  };
}

type PostDispatchOptions = {
  invalidateDetail?: boolean;
};

export function usePostDispatchBooking() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: { headerId: number; invalidateDetail: boolean }) => {
      const payload: DispatchUpdateRequestDTO = {
        postNow: true,
        cancel: false,
        cancelReason: undefined,
        overrideNote: undefined,
        partnerId: undefined as any,
        items: undefined as any,
      } as any;

      return api.request<DispatchResponseDTO>(paths.update(v.headerId), {
        method: "PUT",
        body: payload,
        timeoutMs: 120_000,
      } as any);
    },
    onSuccess: async (_data, vars) => {
      if (!vars.invalidateDetail) return;
      await qc.invalidateQueries({ queryKey: qk.detail(vars.headerId) });
    },
  });

  return {
    post: (headerId: number, options?: { invalidateDetail?: boolean }) =>
      mutation.mutateAsync({
        headerId,
        invalidateDetail: options?.invalidateDetail !== false,
      }),
    reset: mutation.reset,
    data: mutation.data ?? null,
    loading: mutation.isPending,
    errorMessage: mutation.error ? toUserMessage(mutation.error, Strings.settings.errors.generic) : null,
  };
}

type CancelDispatchOptions = {
  invalidateDetail?: boolean;
};

export function useCancelDispatchBooking() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: { headerId: number; cancelReason?: string; invalidateDetail: boolean }) => {
      const payload: DispatchUpdateRequestDTO = {
        cancel: true,
        cancelReason: v.cancelReason?.trim() || undefined,
      } as any;

      return api.request<DispatchResponseDTO>(paths.update(v.headerId), {
        method: "PUT",
        body: payload,
      } as any);
    },
    onSuccess: async (_data, vars) => {
      if (!vars.invalidateDetail) return;
      await qc.invalidateQueries({ queryKey: qk.detail(vars.headerId) });
    },
  });

  const errorMessage = useMemo(() => {
    if (!mutation.error) return null;
    return toUserMessage(mutation.error, Strings.settings.errors.generic);
  }, [mutation.error]);

  return {
    cancel: (headerId: number, cancelReason?: string, options?: CancelDispatchOptions) =>
      mutation.mutateAsync({
        headerId,
        cancelReason,
        invalidateDetail: options?.invalidateDetail !== false,
      }),
    reset: mutation.reset,
    data: mutation.data ?? null,
    loading: mutation.isPending,
    errorMessage,
  };
}
