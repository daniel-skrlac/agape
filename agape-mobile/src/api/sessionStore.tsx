import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "auth_session_v1";

export type AuthSession = {
    token: string;
    userId: number;
    username: string;
    name: string;
    defaultWarehouseByStorageGroup: Record<string, number>;
};

function safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

type Listener = (s: AuthSession | null) => void;
const listeners = new Set<Listener>();

function emit(session: AuthSession | null) {
    listeners.forEach((fn) => fn(session));
}

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

function normalizeSession(raw: AuthSession | null): AuthSession | null {
    if (!raw) return null;
    return {
        ...raw,
        defaultWarehouseByStorageGroup: normalizeWarehouseDefaults(raw.defaultWarehouseByStorageGroup),
    };
}

export function subscribeSession(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export async function saveSession(session: AuthSession) {
    const normalized = normalizeSession(session) ?? session;
    const raw = JSON.stringify(normalized);

    if (Platform.OS === "web") {
        localStorage.setItem(SESSION_KEY, raw);
        emit(normalized);
        return;
    }

    await SecureStore.setItemAsync(SESSION_KEY, raw);
    emit(normalized);
}

export async function getSession(): Promise<AuthSession | null> {
    if (Platform.OS === "web") {
        return normalizeSession(safeParse<AuthSession>(localStorage.getItem(SESSION_KEY)));
    }
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return normalizeSession(safeParse<AuthSession>(raw));
}

export async function clearSession() {
    if (Platform.OS === "web") {
        localStorage.removeItem(SESSION_KEY);
        emit(null);
        return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
    emit(null);
}

export async function getToken(): Promise<string | null> {
    const s = await getSession();
    return s?.token ?? null;
}

export async function updateSession(patch: Partial<AuthSession>) {
    const cur = await getSession();
    if (!cur) return;
    await saveSession({ ...cur, ...patch });
}
