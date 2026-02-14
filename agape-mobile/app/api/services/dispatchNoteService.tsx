import { api } from "@/app/api/api";
import type {
  DispatchResponseDTO,
  DispatchUpdateRequestDTO,
  PagedResultDTO,
} from "@/app/models/generated";

export type DispatchBookingsStatusFilter = "ALL" | "DRAFT" | "FINAL"; // UI tokens

export type DispatchBookingsQuery = {
  warehouseId: number;
  page: number;
  size: number;

  q?: string;
  documentCode?: string; // e.g. OTPREMNICA
  status?: DispatchBookingsStatusFilter;

  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
};

function normalizePaged<T>(x: any, page: number, size: number): PagedResultDTO<T> {
  if (x && Array.isArray(x.items) && typeof x.total === "number") return x as PagedResultDTO<T>;
  if (Array.isArray(x)) return { items: x as T[], page, size, total: (x as T[]).length };
  return { items: [], page, size, total: 0 };
}

export const dispatchNoteService = {
  async search(query: DispatchBookingsQuery, signal?: AbortSignal): Promise<PagedResultDTO<DispatchResponseDTO>> {
    const qs: Record<string, string | number | boolean | undefined | null> = {
      warehouseId: query.warehouseId,
      page: query.page,
      size: query.size,

      q: query.q?.trim() || undefined,
      documentCode: query.documentCode || undefined,

      // backend expects String status; if your filter bean expects other values, adjust here
      status: query.status && query.status !== "ALL" ? query.status : undefined,

      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
    };

    const data = await api.request<PagedResultDTO<DispatchResponseDTO>>("/api/v1/dispatch-note", {
      method: "GET",
      query: qs,
      signal,
    });

    return normalizePaged<DispatchResponseDTO>(data, query.page, query.size);
  },

  async getById(id: number, signal?: AbortSignal): Promise<DispatchResponseDTO> {
    return api.request<DispatchResponseDTO>(`/api/v1/dispatch-note/${id}`, {
      method: "GET",
      signal,
    });
  },

  async update(id: number, body: Partial<DispatchUpdateRequestDTO>, signal?: AbortSignal): Promise<DispatchResponseDTO> {
    return api.request<DispatchResponseDTO>(`/api/v1/dispatch-note/${id}`, {
      method: "PUT",
      body,
      signal,
    });
  },

  async postNow(id: number, signal?: AbortSignal): Promise<DispatchResponseDTO> {
    return this.update(id, { postNow: true }, signal);
  },

  async storno(id: number, cancelReason?: string, signal?: AbortSignal): Promise<DispatchResponseDTO> {
    return this.update(
      id,
      { cancel: true, cancelReason: cancelReason?.trim() || undefined },
      signal
    );
  },
};
