import { useQuery } from "@tanstack/react-query";
import type { PagedResultDTO, ItemDescriptorResponseDTO } from "@/app/models/generated";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";

export function useItemsPage(params: {
  warehouseId: number | null;
  page: number;
  size: number;
  q?: string;
}) {
  const { warehouseId, page, size, q } = params;

  return useQuery<PagedResultDTO<ItemDescriptorResponseDTO>>({
    queryKey: ["items", "page", warehouseId, page, size, q ?? ""],
    enabled: !!warehouseId,
    queryFn: async () => {
      return itemDirectoryService.pageItems({
        warehouseId: warehouseId as number,
        page,
        size,
        q,
      });
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}
