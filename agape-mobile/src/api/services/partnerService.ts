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
    const query = args.q.trim();
    if (query) {
      qs.set("q", query);
      if (/^\d+$/.test(query)) {
        qs.set("partnerNumber", query);
      } else {
        qs.set("nameContains", query);
      }
    }
    return api.request<PagedResultDTO<PartnerResponseDTO>>(`/api/v1/partners?${qs.toString()}`, { method: "GET", signal });
  },
};
