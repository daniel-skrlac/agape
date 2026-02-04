import { api } from "../api";
import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryResponseDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  DispatchBulkResponseDTO,
} from "@/app/models/generated";

export const bookingSessionService = {
  listMine(signal?: AbortSignal) {
    return api.request<BookingSessionResponseDTO[]>("/api/v1/dispatch-booking-sessions", {
      method: "GET",
      signal,
    });
  },

  get(sessionId: number, signal?: AbortSignal) {
    return api.request<BookingSessionResponseDTO>(`/api/v1/dispatch-booking-sessions/${sessionId}`, {
      method: "GET",
      signal,
    });
  },

  create(payload: BookingSessionCreateRequestDTO, signal?: AbortSignal) {
    return api.request<BookingSessionResponseDTO>("/api/v1/dispatch-booking-sessions", {
      method: "POST",
      body: payload,
      signal,
    });
  },

  delete(sessionId: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-booking-sessions/${sessionId}`, {
      method: "DELETE",
      signal,
    });
  },

  upsertEntry(sessionId: number, payload: BookingSessionEntryUpsertRequestDTO, signal?: AbortSignal) {
    return api.request<BookingSessionEntryResponseDTO>(`/api/v1/dispatch-booking-sessions/${sessionId}/entries`, {
      method: "POST",
      body: payload,
      signal,
    });
  },

  deleteEntry(sessionId: number, entryId: number, signal?: AbortSignal) {
    return api.request<void>(`/api/v1/dispatch-booking-sessions/${sessionId}/entries/${entryId}`, {
      method: "DELETE",
      signal,
    });
  },

  finalize(sessionId: number, signal?: AbortSignal) {
    return api.request<DispatchBulkResponseDTO>(`/api/v1/dispatch-booking-sessions/${sessionId}/finalize`, {
      method: "PUT",
      signal,
    });
  },
};
