import { api } from "../api";
import type {
  DispatchBookingDetailDTO,
  DispatchBookingListItemDTO,
  PagedResultDTO,
  DispatchBookingStatus,
} from "@/app/models/generated";

export type DispatchBookingsPageArgs = {
  warehouseId?: number | null; // ✅ optional now
  q?: string;
  documentCode?: string | null;
  status?: DispatchBookingStatus | "ALL" | "DRAFT" | "FINAL" | "CANCELLED";
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  page?: number;
  size?: number;
};

export const dispatchBookingService = {
  async page(args: DispatchBookingsPageArgs, signal?: AbortSignal): Promise<PagedResultDTO<DispatchBookingListItemDTO>> {
    const qs = new URLSearchParams();

    // ✅ only send warehouseId if provided
    if (args.warehouseId != null) qs.set("warehouseId", String(args.warehouseId));

    if (args.q) qs.set("q", args.q);
    if (args.documentCode) qs.set("documentCode", args.documentCode);

    if (args.status) qs.set("status", String(args.status));
    if (args.dateFrom) qs.set("dateFrom", args.dateFrom);
    if (args.dateTo) qs.set("dateTo", args.dateTo);

    qs.set("page", String(args.page ?? 0));
    qs.set("size", String(args.size ?? 20));

    return api.request<PagedResultDTO<DispatchBookingListItemDTO>>(`/api/v1/dispatch/bookings?${qs.toString()}`, {
      method: "GET",
      signal,
    });
  },

  async detail(headerId: number, signal?: AbortSignal): Promise<DispatchBookingDetailDTO> {
    return api.request<DispatchBookingDetailDTO>(`/api/v1/dispatch/bookings/${headerId}`, {
      method: "GET",
      signal,
    });
  },
};
