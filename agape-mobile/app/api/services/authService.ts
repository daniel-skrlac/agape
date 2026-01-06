import { createApiClient } from "../apiClient";
import { API_BASE_URL } from "../config";
import type { AuthResponseDTO, LoginRequestDTO, RegisterRequestDTO, RegisterResponseDTO } from "../../models/generated";
import { clearToken, saveToken } from "../tokenStore";

const api = createApiClient({ baseUrl: API_BASE_URL });

export const authService = {
    async login(payload: LoginRequestDTO): Promise<AuthResponseDTO> {
        const data = await api.request<AuthResponseDTO>("/api/v1/auth/login", {
            method: "POST",
            body: payload,
        });

        // store token
        await saveToken(data.token);
        return data;
    },

    async register(payload: RegisterRequestDTO): Promise<RegisterResponseDTO> {
        return api.request<RegisterResponseDTO>("/api/v1/auth/register", {
            method: "POST",
            body: payload,
        });
    },

    async logout(): Promise<void> {
        await clearToken();
    },
};
