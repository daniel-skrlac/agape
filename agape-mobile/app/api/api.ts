import { router } from "expo-router";
import { createApiClient } from "./apiClient";
import { API_BASE_URL } from "./config";
import { clearSession, getToken } from "./sessionStore";

let loggingOut = false;

export const api = createApiClient({
    baseUrl: API_BASE_URL,
    getToken,
    onUnauthorized: async () => {
        if (loggingOut) return;
        loggingOut = true;
        try {
            await clearSession();
            router.replace("/");
        } finally {
            loggingOut = false;
        }
    },
});
