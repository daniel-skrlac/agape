import { useQuery } from "@tanstack/react-query";
import { stockStatisticsService } from "../../services/dashboard/stockStatisticsService";

export function useStockStatistics(args: {
    warehouseId?: number | null;
    storageGroupId?: number | null;
    documentYear?: number | null;
    documentCode?: string | null;
}) {
    return useQuery({
        queryKey: [
            "stock-statistics",
            args.warehouseId ?? "ALL_WAREHOUSES",
            args.storageGroupId ?? "ALL_TYPES",
            args.documentYear ?? "ALL_YEARS",
            args.documentCode ?? "OTPREMNICA",
        ],
        queryFn: ({ signal }) => stockStatisticsService.get(args, signal),
        placeholderData: (previousData) => previousData,
        staleTime: 30_000,
        retry: 1,
        refetchOnReconnect: true,
    });
}
