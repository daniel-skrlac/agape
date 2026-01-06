import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "auth_session_v1";

export type AuthSession = {
    token: string;
    userId: number;
    username: string;
    name: string;
};

function safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function saveSession(session: AuthSession) {
    const raw = JSON.stringify(session);
    if (Platform.OS === "web") {
        localStorage.setItem(SESSION_KEY, raw);
        return;
    }
    await SecureStore.setItemAsync(SESSION_KEY, raw);
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
        return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getToken(): Promise<string | null> {
    const s = await getSession();
    return s?.token ?? null;
}
