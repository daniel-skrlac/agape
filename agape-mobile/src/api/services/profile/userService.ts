
import type { UpdateUserRequestDTO } from "../../../../src/models/generated";
import { api } from "../../api";

export const userService = {
    getById(id: number, signal?: AbortSignal) {
        return api.request<any>(`/api/v1/users/${encodeURIComponent(id)}`, {
            method: "GET",
            signal,
        });
    },
    update(id: number, payload: UpdateUserRequestDTO, signal?: AbortSignal) {
        return api.request<any>(`/api/v1/users/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: payload,
            signal,
        });
    },
};
