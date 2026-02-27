import { useQuery } from "@tanstack/react-query";
import { warehouseService } from "../../services/settings/warehouseService";

export function useWarehouses() {
    return useQuery({
        queryKey: ["warehouses"],
        queryFn: () => warehouseService.getAll(),
        retry: 1,
        refetchOnReconnect: true,
    });
}
