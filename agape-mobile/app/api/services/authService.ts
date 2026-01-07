import type {
    AuthResponseDTO,
    LoginRequestDTO,
    RegisterRequestDTO,
    RegisterResponseDTO,
} from "../../models/generated";
import { clearSession, saveSession } from "../sessionStore";
import { api } from "../api";

export const authService = {
    async login(payload: LoginRequestDTO): Promise<AuthResponseDTO> {
        const data = await api.request<AuthResponseDTO>("/api/v1/auth/login", {
            method: "POST",
            body: payload,
        });

        await saveSession({
            token: data.token,
            userId: data.userId,
            username: data.username,
            name: data.name,
        });

        return data;
    },

    async register(payload: RegisterRequestDTO): Promise<RegisterResponseDTO> {
        return api.request<RegisterResponseDTO>("/api/v1/auth/register", {
            method: "POST",
            body: payload,
        });
    },

    async logout(): Promise<void> {
        await clearSession();
    },
};
