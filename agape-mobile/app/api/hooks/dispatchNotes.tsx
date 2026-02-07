// app/api/dispatchNotes.ts
import type {
  PagedResultDTO,
  DispatchResponseDTO,
} from "@/app/models/generated";
import { api } from "../api";

export type DispatchBookingsStatusFilter = "ALL" | "DRAFT" | "FINAL";

export type DispatchBookingsSort = "BOOKED_DESC" | "BOOKED_ASC";

export type DispatchBookingsQuery = {
  warehouseId: number;

  // search by document name/code (backend q)
  q?: string;

  // document code (e.g. OTPREMNICA) - backend param name might be documentCode
  documentCode?: string;

  // status filter for backend (optional if backend supports it)
  status?: DispatchBookingsStatusFilter;

  // yyyy-mm-dd (or ISO) depending on backend; safest: yyyy-mm-dd
  dateFrom?: string;
  dateTo?: string;

  sort?: DispatchBookingsSort;

  page: number;
  size: number;
};

export async function fetchDispatchBookingsPage(query: DispatchBookingsQuery) {
  // Map frontend enum -> backend expected values (adjust if your backend uses different tokens)
  const status =
    query.status === "ALL" ? undefined : query.status;

  const sort = query.sort ?? "BOOKED_DESC";

  return api.request<PagedResultDTO<DispatchResponseDTO>>("/api/v1/dispatch-note", {
    method: "GET",
    query: {
      warehouseId: query.warehouseId,
      q: query.q || undefined,
      documentCode: query.documentCode || undefined,
      status: status || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
      sort,
      page: query.page,
      size: query.size,
    },
  });
}

export async function fetchDispatchById(id: number) {
  // If you don't have GET by id, you can remove this and pass item via router params/state.
  return api.request<DispatchResponseDTO>(`/api/v1/dispatch-note/${id}`, {
    method: "GET",
  });
}

export async function cancelDispatch(args: { id: number; cancelReason?: string }) {
  return api.request<DispatchResponseDTO>(`/api/v1/dispatch-note/${args.id}`, {
    method: "PUT",
    body: {
      cancel: true,
      cancelReason: args.cancelReason || "",
    },
  });
}
