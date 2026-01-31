import type { PagedResultDTO, ItemDescriptorResponseDTO } from "@/app/models/generated";
import { api } from "../api";

const ITEMS_PATH = "/api/v1/item-directory";

export const itemDirectoryService = {
    async pageItems(params: {
        warehouseId: number | string;
        page: number;
        size: number;
        q?: string;
    }): Promise<PagedResultDTO<ItemDescriptorResponseDTO>> {
        const { warehouseId, page, size, q } = params;

        return api.request<PagedResultDTO<ItemDescriptorResponseDTO>>(ITEMS_PATH + "/items", {
            method: "GET",
            query: {
                warehouseId,
                page,
                size,
                q: q?.trim() ? q.trim() : undefined,
            },
        });
    },
};
