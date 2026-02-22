import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
} from "@/app/models/generated";
import dispatchBookingSessionService, { BookingSessionPageDTO } from "../../services/dispatchTemplateSessionService";


const qk = {
  list: (status?: string | null, size?: number) =>
    ["bookingSessions", "list", status ?? "ALL", size ?? 20] as const,
  one: (id: number) => ["bookingSessions", "one", id] as const,
};

type UseBookingSessionsOptions = {
  size?: number;
};

export function useBookingSessions(status?: string | null, options?: UseBookingSessionsOptions) {
  const size = Number(options?.size ?? 20);

  const q = useInfiniteQuery({
    queryKey: qk.list(status, size),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      dispatchBookingSessionService.list({
        status: status ?? undefined,
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
    staleTime: 10_000,
  });

  const data = useMemo<BookingSessionResponseDTO[]>(
    () => (q.data?.pages ?? []).flatMap((p) => p?.items ?? []),
    [q.data]
  );

  const first = q.data?.pages?.[0];
  const total = Number(first?.total ?? 0);

  return {
    data,
    total,

    error: q.error,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isRefetching: q.isRefetching,
    refreshing: q.isRefetching && !q.isFetchingNextPage,

    loadingMore: q.isFetchingNextPage,
    canLoadMore: !!q.hasNextPage,
    loadMoreError: q.isFetchNextPageError ? q.error : null,

    refetch: q.refetch,
    refresh: q.refetch,
    loadMore: () => q.fetchNextPage(),

    clearStatus: () => {
      // no-op, kept for compatibility with your existing screen patterns
    },
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
    mutationFn: (payload: BookingSessionCreateRequestDTO) => dispatchBookingSessionService.create(payload),
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
    mutationFn: (partnerId: number) => dispatchBookingSessionService.deleteEntry(sessionId, partnerId),
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