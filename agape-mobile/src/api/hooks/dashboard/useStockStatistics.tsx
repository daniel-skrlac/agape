import { useQuery } from "@tanstack/react-query";
import { stockStatisticsService } from "../../services/dashboard/stockStatisticsService";

export function useStockStatistics(warehouseId: number | null) {
    return useQuery({
        queryKey: ["stock-statistics", warehouseId],
        enabled: warehouseId != null,
        queryFn: () => stockStatisticsService.get(warehouseId as number),
        retry: 1,
        refetchOnReconnect: true,
    });
}
