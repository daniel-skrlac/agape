import { StockStatisticsResponseDTO } from "@/app/models/generated";
import { api } from "../../api";


export const stockStatisticsService = {
  get(warehouseId: number, signal?: AbortSignal) {
    return api.request<StockStatisticsResponseDTO>(
      `/api/v1/stock-statistics?warehouseId=${encodeURIComponent(warehouseId)}`,
      { method: "GET", signal }
    );
  },
};