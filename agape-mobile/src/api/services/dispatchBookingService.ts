import { api } from "../api";
import type {
  DispatchBookingDetailDTO,
  DispatchBookingListItemDTO,
  PagedResultDTO,
  DispatchBookingStatus,
} from "@/src/models/generated";

export type DispatchBookingsPageArgs = {
  warehouseId?: number | null;
  q?: string;
  documentCode?: string | null;
  status?: DispatchBookingStatus | "ALL" | "DRAFT" | "FINAL" | "CANCELLED";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  size?: number;
};

export const dispatchBookingService = {
  async page(args: DispatchBookingsPageArgs, signal?: AbortSignal): Promise<PagedResultDTO<DispatchBookingListItemDTO>> {
    const qs = new URLSearchParams();

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
