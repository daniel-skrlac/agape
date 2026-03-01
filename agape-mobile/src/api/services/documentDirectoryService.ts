import { api } from "../api";
import type { DocumentDescriptorResponseDTO, PagedResultDTO } from "@/src/models/generated";

function normalizeDocTypesPayload(x: any): DocumentDescriptorResponseDTO[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items)) return x.items;
  return [];
}

function toExcludeIdCsv(ids?: Array<number | null | undefined>): string {
  const set = new Set<number>();
  for (const v of ids ?? []) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return Array.from(set).join(",");
}

export const documentDirectoryService = {
  async listDocTypesByCode(
    args: {
      warehouseId?: number | null;
      documentCode: string;
      q?: string;
      excludeDocumentIds?: number[];
    },
    signal?: AbortSignal
  ): Promise<DocumentDescriptorResponseDTO[]> {
    const qs = new URLSearchParams();
    if (args.warehouseId != null) qs.set("warehouseId", String(args.warehouseId));
    qs.set("documentCode", args.documentCode);
    if (args.q) qs.set("q", args.q);

    const excludeCsv = toExcludeIdCsv(args.excludeDocumentIds);
    if (excludeCsv) qs.set("excludeDocumentIds", excludeCsv);

    const data = await api.request<DocumentDescriptorResponseDTO[] | PagedResultDTO<DocumentDescriptorResponseDTO>>(
      `/api/v1/document-directory/doc-types?${qs.toString()}`,
      { method: "GET", signal }
    );

    return normalizeDocTypesPayload(data);
  },
};