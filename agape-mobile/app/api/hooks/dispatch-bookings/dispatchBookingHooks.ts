import Strings from "@/constants/Strings";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/api/api";
import { toUserMessage } from "@/app/api/apiClient";

import type {
  DispatchBookingDetailDTO,
  DispatchRequestValidationDTO,
  DispatchResponseDTO,
  DispatchUpdateRequestDTO,
} from "@/app/models/generated";

const paths = {
  detail: (id: number) => `/api/v1/dispatch/bookings/${id}`,
  validate: `/api/v1/dispatch/validate`,
  post: (id: number) => `/api/v1/dispatch-bookings/${id}/post`,
  cancel: (id: number) => `/api/v1/dispatch-note/${id}`,
};

const qk = {
  detail: (id: number) => ["dispatchBookingDetail", id] as const,
};

export function useDispatchBookingDetail(headerId: number | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: headerId ? qk.detail(headerId) : ["dispatchBookingDetail", "null"],
    enabled: !!headerId,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
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
      api.request<any>(paths.validate, { method: "POST", body: payload } as any),
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
    mutationFn: ({ headerId }: { headerId: number; invalidateDetail: boolean }) =>
      api.request<any>(paths.post(headerId), { method: "POST" } as any),
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
    post: (headerId: number, options?: PostDispatchOptions) =>
      mutation.mutateAsync({
        headerId,
        invalidateDetail: options?.invalidateDetail !== false,
      }),
    reset: mutation.reset,
    data: mutation.data ?? null,
    loading: mutation.isPending,
    errorMessage,
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

      return api.request<DispatchResponseDTO>(paths.cancel(v.headerId), {
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