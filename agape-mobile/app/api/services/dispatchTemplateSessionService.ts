import type {
  BookingSessionCreateRequestDTO,
  BookingSessionEntryUpsertRequestDTO,
  BookingSessionResponseDTO,
  DispatchBulkResponseDTO,
} from "@/app/models/generated";
import { api } from "../api";

const BASE = "/api/v1/dispatch-booking-sessions";

export type BookingSessionPageDTO = {
  items: BookingSessionResponseDTO[];
  page: number;
  size: number;
  total: number;
};

type ListParams = {
  status?: string | null;
  page?: number;
  size?: number;
};

const dispatchBookingSessionService = {
  list: async ({ status, page = 0, size = 20 }: ListParams = {}): Promise<BookingSessionPageDTO> => {
    const res = await api.request<any>(BASE, {
      method: "GET",
      query: {
        ...(status ? { status } : {}),
        page,
        size,
      },
    });

    return {
      items: Array.isArray(res?.items) ? res.items : [],
      page: Number(res?.page ?? page),
      size: Number(res?.size ?? size),
      total: Number(res?.total ?? 0),
    };
  },

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