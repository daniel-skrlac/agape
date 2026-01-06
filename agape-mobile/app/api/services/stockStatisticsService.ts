import { createApiClient } from "../apiClient";
import { API_BASE_URL } from "../config";
import type { StockStatisticsResponseDTO } from "../../models/generated";
import { getToken } from "../sessionStore";

const api = createApiClient({ baseUrl: API_BASE_URL, getToken });

export const stockStatisticsService = {
  get(warehouseId: number, signal?: AbortSignal) {
    return api.request<StockStatisticsResponseDTO>(
      `/api/v1/stock-statistics?warehouseId=${encodeURIComponent(warehouseId)}`,
      { method: "GET", signal }
    );
  },
};