// app/api/hooks/useBookingSessions.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
} from "@/app/models/generated";
import dispatchBookingSessionService from "../services/dispatchTemplateSessionService";

const qk = {
  list: (status?: string | null) => ["bookingSessions", "list", status ?? "ALL"] as const,
  one: (id: number) => ["bookingSessions", "one", id] as const,
};

export function useBookingSessions(status?: string | null) {
  return useQuery({
    queryKey: qk.list(status),
    queryFn: () => dispatchBookingSessionService.list(status ?? undefined),
  });
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

export function useUpsertBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingSessionEntryUpsertRequestDTO) =>
      dispatchBookingSessionService.upsertEntry(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
      qc.invalidateQueries({ queryKey: qk.list(null) });
    },
  });
}

export function useDeleteBookingSessionEntry(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    // ✅ backend briše po partnerId: DELETE /{id}/entries/{partnerId}
    mutationFn: (partnerId: number) => dispatchBookingSessionService.deleteEntry(sessionId, partnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
    },
  });
}

export function useFinalizeBookingSession(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dispatchBookingSessionService.finalize(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.one(sessionId) });
      qc.invalidateQueries({ queryKey: qk.list(null) });
    },
  });
}
