import { useQuery } from "@tanstack/react-query";
import { warehouseService } from "../../services/settings/warehouseService";

export function useWarehouses() {
    return useQuery({
        queryKey: ["warehouses"],
        queryFn: () => warehouseService.getAll(),
        staleTime: 16 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
        refetchOnReconnect: true,
    });
}
