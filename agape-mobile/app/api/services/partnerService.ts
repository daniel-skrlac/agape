import { api } from "../api";
import type { PagedResultDTO, PartnerResponseDTO } from "@/app/models/generated";

export const partnerService = {
  pagePartners(args: { page: number; size: number; q: string }, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    qs.set("page", String(args.page));
    qs.set("size", String(args.size));
    if (args.q) qs.set("q", args.q);
    return api.request<PagedResultDTO<PartnerResponseDTO>>(`/api/v1/partners?${qs.toString()}`, { method: "GET", signal });
  },
};
