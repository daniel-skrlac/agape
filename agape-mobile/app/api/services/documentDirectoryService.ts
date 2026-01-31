import { api } from "../api";
import type { DocumentDescriptorResponseDTO, PagedResultDTO } from "@/app/models/generated";

function normalizeDocTypesPayload(x: any): DocumentDescriptorResponseDTO[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items)) return x.items; // PagedResultDTO shape
  return [];
}

export const documentDirectoryService = {
  /**
   * Works with BOTH backend responses:
   * - List<DocumentDescriptorResponseDTO>
   * - PagedResultDTO<DocumentDescriptorResponseDTO>
   */
  async listDocTypesByCode(
    args: {
      warehouseId?: number | null;
      documentCode: string;
      q?: string;
    },
    signal?: AbortSignal
  ): Promise<DocumentDescriptorResponseDTO[]> {
    const qs = new URLSearchParams();
    if (args.warehouseId != null) qs.set("warehouseId", String(args.warehouseId));
    qs.set("documentCode", args.documentCode);
    if (args.q) qs.set("q", args.q);

    const data = await api.request<DocumentDescriptorResponseDTO[] | PagedResultDTO<DocumentDescriptorResponseDTO>>(
      `/api/v1/document-directory/doc-types?${qs.toString()}`,
      { method: "GET", signal }
    );

    return normalizeDocTypesPayload(data);
  },

  /**
   * If you still use paging elsewhere, keep it.
   * If not used anymore, you can delete it.
   */
  pageDocTypes(
    args: {
      page: number;
      size: number;
      q?: string;
      warehouseId?: number | null;
      documentCode?: string | null;
    },
    signal?: AbortSignal
  ) {
    const qs = new URLSearchParams();
    qs.set("page", String(args.page));
    qs.set("size", String(args.size));
    if (args.q) qs.set("q", args.q);
    if (args.warehouseId != null) qs.set("warehouseId", String(args.warehouseId));
    if (args.documentCode) qs.set("documentCode", args.documentCode);

    return api.request<PagedResultDTO<DocumentDescriptorResponseDTO>>(
      `/api/v1/document-directory/doc-types?${qs.toString()}`,
      { method: "GET", signal }
    );
  },
};
