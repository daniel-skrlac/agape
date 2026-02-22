import { useCallback } from "react";

import type { ItemDescriptorResponseDTO } from "@/app/models/generated";
import { itemDirectoryService } from "@/app/api/services/itemDirectoryService";

export type ItemPickerPageArgs = {
    page: number;
    size: number;
    q?: string;
};

export type ItemPickerPageResult = {
    items: ItemDescriptorResponseDTO[];
    page: number;
    size: number;
    total: number;
};

type UseItemDirectoryPickerPageArgs = {
    warehouseId: number | null | undefined;
    enabled?: boolean;
};

export function useItemDirectoryPickerPage(args: UseItemDirectoryPickerPageArgs) {
    const { warehouseId, enabled = true } = args;

    const fetchItemsPage = useCallback(
        async ({ page, size, q }: ItemPickerPageArgs): Promise<ItemPickerPageResult> => {
            if (!enabled || !warehouseId) {
                return {
                    items: [],
                    page,
                    size,
                    total: 0,
                };
            }

            const res = await itemDirectoryService.pageItems({
                warehouseId: Number(warehouseId),
                page,
                size,
                q: q?.trim() ? q.trim() : undefined,
            });

            return {
                items: res.items ?? [],
                page: res.page ?? page,
                size: res.size ?? size,
                total: res.total ?? 0,
            };
        },
        [warehouseId, enabled]
    );

    return {
        fetchItemsPage,
    };
}