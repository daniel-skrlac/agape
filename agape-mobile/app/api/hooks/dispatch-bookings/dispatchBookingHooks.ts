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
        queryFn: ({ signal }) => api.request<DispatchBookingDetailDTO>(paths.detail(Number(headerId)), { signal } as any),
    });

    const errorMessage = useMemo(() => {
        if (!query.error) return null;
        return toUserMessage(query.error, Strings.settings.errors.generic);
    }, [query.error]);

    const setBooking = (d: DispatchBookingDetailDTO) => {
        if (!headerId) return;
        qc.setQueryData(qk.detail(headerId), d);
    };

    return {
        headerId,
        booking: query.data ?? null,
        loading: query.isLoading,
        fetching: query.isFetching,
        errorMessage,
        refetch: query.refetch,
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

export function usePostDispatchBooking() {
    const mutation = useMutation({
        mutationFn: (headerId: number) => api.request<any>(paths.post(headerId), { method: "POST" } as any),
    });

    const errorMessage = useMemo(() => {
        if (!mutation.error) return null;
        return toUserMessage(mutation.error, Strings.settings.errors.generic);
    }, [mutation.error]);

    return {
        post: mutation.mutateAsync,
        reset: mutation.reset,
        data: mutation.data ?? null,
        loading: mutation.isPending,
        errorMessage,
    };
}

export function useCancelDispatchBooking() {
    const mutation = useMutation({
        mutationFn: (v: { headerId: number; cancelReason?: string }) => {
            const payload: DispatchUpdateRequestDTO = {
                cancel: true,
                cancelReason: v.cancelReason?.trim() || undefined,
            } as any;

            return api.request<DispatchResponseDTO>(paths.cancel(v.headerId), { method: "PUT", body: payload } as any);
        },
    });

    const errorMessage = useMemo(() => {
        if (!mutation.error) return null;
        return toUserMessage(mutation.error, Strings.settings.errors.generic);
    }, [mutation.error]);

    return {
        cancel: (headerId: number, cancelReason?: string) => mutation.mutateAsync({ headerId, cancelReason }),
        reset: mutation.reset,
        data: mutation.data ?? null,
        loading: mutation.isPending,
        errorMessage,
    };
}
