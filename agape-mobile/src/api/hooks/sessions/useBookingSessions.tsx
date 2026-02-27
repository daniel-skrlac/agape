import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
} from "@/src/models/generated";
import dispatchBookingSessionService, {
  type BookingSessionPageDTO,
} from "../../services/dispatchTemplateSessionService";

const qk = {
  list: (
    status?: string | null,
    q?: string | null,
    dateFrom?: string | null,
    dateTo?: string | null,
    size?: number
  ) =>
    [
      "bookingSessions",
      "list",
      status ?? "ALL",
      q ?? "",
      dateFrom ?? "",
      dateTo ?? "",
      size ?? 20,
    ] as const,

  one: (id: number) => ["bookingSessions", "one", id] as const,
};

export type UseBookingSessionsParams = {
  status?: "DRAFT" | "FINALIZED" | "CANCELLED" | null;
  q?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  size?: number;
};

export function useBookingSessions(params?: UseBookingSessionsParams) {
  const status = params?.status ?? null;
  const q = (params?.q ?? "").trim() || null;
  const dateFrom = params?.dateFrom ?? null;
  const dateTo = params?.dateTo ?? null;
  const size = Math.max(1, Math.min(200, Number(params?.size ?? 20)));

  const iq = useInfiniteQuery({
    queryKey: qk.list(status, q, dateFrom, dateTo, size),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      dispatchBookingSessionService.list({
        status,
        q,
        dateFrom,
        dateTo,
        page: Number(pageParam ?? 0),
        size,
      }),
    getNextPageParam: (lastPage: BookingSessionPageDTO) => {
      const page = Number(lastPage?.page ?? 0);
      const pageSize = Number(lastPage?.size ?? size);
      const total = Number(lastPage?.total ?? 0);

      const loaded = (page + 1) * pageSize;
      return loaded < total ? page + 1 : undefined;
    },
  });

  const data = useMemo<BookingSessionResponseDTO[]>(
    () => (iq.data?.pages ?? []).flatMap((p) => p?.items ?? []),
    [iq.data]
  );

  const first = iq.data?.pages?.[0];
  const total = Number(first?.total ?? 0);

  return {
    data,
    total,

    error: iq.error,
    isLoading: iq.isLoading,
    isFetching: iq.isFetching,
    isRefetching: iq.isRefetching,

    refreshing: iq.isRefetching && !iq.isFetchingNextPage,
    loadingMore: iq.isFetchingNextPage,
    canLoadMore: !!iq.hasNextPage,
    loadMoreError: iq.isFetchNextPageError ? iq.error : null,

    refresh: () => iq.refetch(),
    refetch: () => iq.refetch(),
    loadMore: () => iq.fetchNextPage(),
  };
}

export function useBookingSession(sessionId: number | null) {
  return useQuery({
    queryKey: sessionId ? qk.one(sessionId) : ["bookingSessions", "one", "null"],
    queryFn: () => dispatchBookingSessionService.get(Number(sessionId)),
    enabled: !!sessionId,
  });
}

export function useCreateBookingSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookingSessionCreateRequestDTO) =>
      dispatchBookingSessionService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}

export function useDeleteBookingSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => dispatchBookingSessionService.deleteSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}

export function useCancelBookingSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => dispatchBookingSessionService.cancel(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}

export function useUpsertBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookingSessionEntryUpsertRequestDTO) =>
      dispatchBookingSessionService.upsertEntry(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}

export function useDeleteBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (partnerId: number) =>
      dispatchBookingSessionService.deleteEntry(sessionId, partnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}

export function useFinalizeBookingSession(sessionId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => dispatchBookingSessionService.finalize(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
      qc.invalidateQueries({ queryKey: ["bookingSessions"] });
    },
  });
}