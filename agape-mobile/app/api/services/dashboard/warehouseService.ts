import { api } from "../api";

export const warehouseService = {
    getAll(signal?: AbortSignal) {
        return api.request<number[]>("/api/v1/warehouses", {
            method: "GET",
            signal,
        });
    },
};
