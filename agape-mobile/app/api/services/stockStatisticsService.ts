import { createApiClient } from "../apiClient";
import { API_BASE_URL } from "../config";
import type { StockStatisticsResponseDTO } from "../../models/generated";
import { getToken } from "../tokenStore";

const api = createApiClient({ baseUrl: API_BASE_URL, getToken });

export const stockStatisticsService = {
    get(signal?: AbortSignal) {
        return api.request<StockStatisticsResponseDTO>("/api/v1/stock-statistics", {
            method: "GET",
            signal,
        });
    },
};
