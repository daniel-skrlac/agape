// app/api/services/dispatchBookingSessionService.ts
import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  DispatchBulkResponseDTO,
} from "@/app/models/generated";
import { api } from "../api";

const BASE = "/api/v1/dispatch-booking-sessions";

export const dispatchBookingSessionService = {
  list: (status?: string | null) =>
    api.request<BookingSessionResponseDTO[]>(BASE, {
      method: "GET",
      query: status ? { status } : undefined,
    }),

  create: (payload: BookingSessionCreateRequestDTO) =>
    api.request<BookingSessionResponseDTO>(BASE, {
      method: "POST",
      body: payload,
    }),

  get: (id: number) =>
    api.request<BookingSessionResponseDTO>(`${BASE}/${id}`, {
      method: "GET",
    }),

  upsertEntry: (sessionId: number, payload: BookingSessionEntryUpsertRequestDTO) =>
    api.request(`${BASE}/${sessionId}/entries`, {
      method: "PUT",
      body: payload,
    }),

  deleteEntry: (sessionId: number, partnerId: number) =>
    api.request(`${BASE}/${sessionId}/entries/${partnerId}`, {
      method: "DELETE",
    }),

  finalize: (sessionId: number) =>
    api.request<DispatchBulkResponseDTO>(`${BASE}/${sessionId}/finalize`, {
      method: "POST",
    }),

  cancel: (sessionId: number) =>
    api.request(`${BASE}/${sessionId}/cancel`, {
      method: "POST",
    }),

  deleteSession: (sessionId: number) =>
    api.request(`${BASE}/${sessionId}`, {
      method: "DELETE",
    }),
};

export default dispatchBookingSessionService;
