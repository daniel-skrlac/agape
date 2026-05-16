import { api } from "../api";
import type { PagedResultDTO, PartnerResponseDTO } from "@/src/models/generated";

export const partnerService = {
  getPartner(id: number, signal?: AbortSignal) {
    return api.request<PartnerResponseDTO>(`/api/v1/partners/${id}`, { method: "GET", signal });
  },

  pagePartners(args: { page: number; size: number; q: string }, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    qs.set("page", String(args.page));
    qs.set("size", String(args.size));
    if (args.q) {
      qs.set("q", args.q);
      qs.set("nameContains", args.q);
    }
    return api.request<PagedResultDTO<PartnerResponseDTO>>(`/api/v1/partners?${qs.toString()}`, { method: "GET", signal });
  },
};
