import { api } from "../api";
import type { PagedResultDTO, DocumentDescriptorResponseDTO } from "@/app/models/generated";

export const documentDirectoryService = {
  pageDocTypes(args: { page: number; size: number; q: string }, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    qs.set("page", String(args.page));
    qs.set("size", String(args.size));
    if (args.q) qs.set("q", args.q);
    return api.request<PagedResultDTO<DocumentDescriptorResponseDTO>>(
      `/api/v1/document-directory/doc-types?${qs.toString()}`,
      { method: "GET", signal }
    );
  },
};
