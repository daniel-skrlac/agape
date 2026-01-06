import { createApiClient } from "../apiClient";
import { API_BASE_URL } from "../config";
import { getToken } from "../sessionStore";

const api = createApiClient({ baseUrl: API_BASE_URL, getToken });

export const warehouseService = {
    getAll(signal?: AbortSignal) {
        return api.request<number[]>("/api/v1/warehouses", {
            method: "GET",
            signal,
        });
    },
};
