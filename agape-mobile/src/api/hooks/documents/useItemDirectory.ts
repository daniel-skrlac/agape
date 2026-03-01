import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ItemDescriptorResponseDTO, PagedResultDTO } from "@/src/models/generated";
import { itemDirectoryService } from "../../../../src/api/services/itemDirectoryService";

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

const itemKeys = {
    page: (params: {
        warehouseId: number;
        page: number;
        size: number;
        q: string;
    }) => ["items", "page", params] as const,
};

export function useItemDirectory(args: UseItemDirectoryPickerPageArgs) {
    const { warehouseId, enabled = true } = args;
    const queryClient = useQueryClient();

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

            const normalizedQ = q?.trim() ?? "";

            const res = await queryClient.fetchQuery<PagedResultDTO<ItemDescriptorResponseDTO>>({
                queryKey: itemKeys.page({
                    warehouseId: Number(warehouseId),
                    page,
                    size,
                    q: normalizedQ,
                }),
                queryFn: () =>
                    itemDirectoryService.pageItems({
                        warehouseId: Number(warehouseId),
                        page,
                        size,
                        q: normalizedQ || undefined,
                    }),
                staleTime: 57_600_000,
                gcTime: 24 * 60 * 60_000,
            });

            return {
                items: res.items ?? [],
                page: res.page ?? page,
                size: res.size ?? size,
                total: res.total ?? 0,
            };
        },
        [enabled, warehouseId, queryClient]
    );

    const invalidateItemsCache = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ["items"] });
    }, [queryClient]);

    return {
        fetchItemsPage,
        invalidateItemsCache,
    };
}