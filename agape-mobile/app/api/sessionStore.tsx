import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "auth_session_v1";

export type AuthSession = {
    token: string;
    userId: number;
    username: string;
    name: string;
    defaultWarehouseId?: number | null;
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

export function subscribeSession(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export async function saveSession(session: AuthSession) {
    const raw = JSON.stringify(session);

    if (Platform.OS === "web") {
        localStorage.setItem(SESSION_KEY, raw);
        emit(session);
        return;
    }

    await SecureStore.setItemAsync(SESSION_KEY, raw);
    emit(session);
}

export async function getSession(): Promise<AuthSession | null> {
    if (Platform.OS === "web") {
        return safeParse<AuthSession>(localStorage.getItem(SESSION_KEY));
    }
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return safeParse<AuthSession>(raw);
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
