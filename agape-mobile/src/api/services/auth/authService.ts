import type {
    AuthResponseDTO,
    LoginRequestDTO,
    RegisterRequestDTO,
    RegisterResponseDTO,
} from "../../../../src/models/generated";
import { clearSession, saveSession } from "../../sessionStore";
import { api } from "../../api";

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
            defaultWarehouseByStorageGroup: normalizeWarehouseDefaults((data as any).defaultWarehouseByStorageGroup),
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

function normalizeWarehouseDefaults(raw: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw || typeof raw !== "object") return out;

    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const storageGroupId = String(key).trim();
        const warehouseId = Number(value);
        if (!storageGroupId || !Number.isFinite(warehouseId) || warehouseId <= 0) continue;
        out[storageGroupId] = warehouseId;
    }

    return out;
}
