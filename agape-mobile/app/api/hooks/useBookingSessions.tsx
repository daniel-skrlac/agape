import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingSessionCreateRequestDTO, BookingSessionEntryUpsertRequestDTO } from "@/app/models/generated";
import { bookingSessionService } from "../services/dispatchTemplateSessionService";

const keys = {
  list: ["booking-sessions"] as const,
  one: (id: number) => ["booking-session", id] as const,
};

export function useBookingSessions() {
  return useQuery({
    queryKey: keys.list,
    queryFn: ({ signal }) => bookingSessionService.listMine(signal),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useBookingSession(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: keys.one(Number(sessionId || 0)),
    queryFn: ({ signal }) => bookingSessionService.get(Number(sessionId), signal),
    enabled: !!sessionId && Number(sessionId) > 0,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useCreateBookingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingSessionCreateRequestDTO) => bookingSessionService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useDeleteBookingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bookingSessionService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useUpsertBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingSessionEntryUpsertRequestDTO) => bookingSessionService.upsertEntry(sessionId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.one(sessionId) }),
  });
}

export function useDeleteBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => bookingSessionService.deleteEntry(sessionId, entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.one(sessionId) }),
  });
}

export function useFinalizeBookingSession(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bookingSessionService.finalize(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.list });
      qc.invalidateQueries({ queryKey: keys.one(sessionId) });
    },
  });
}
