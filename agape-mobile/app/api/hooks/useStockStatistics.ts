import { useQuery } from "@tanstack/react-query";
import { stockStatisticsService } from "../services/stockStatisticsService";

export function useStockStatistics() {
    return useQuery({
        queryKey: ["stockStatistics"],
        queryFn: ({ signal }) => stockStatisticsService.get(signal),
        staleTime: 30_000,
    });
}
