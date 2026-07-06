import Constants from "expo-constants";

const expoExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const legacyManifestExtra =
    (((Constants as any).manifest2?.extra?.expoClient?.extra ??
        (Constants as any).manifest?.extra) ?? {}) as Record<string, unknown>;

const configuredApiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    asString(expoExtra.API_BASE_URL) ??
    asString(legacyManifestExtra.API_BASE_URL) ??
    "http://localhost:8080";

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);

function asString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeApiBaseUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "http://localhost:8080";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}
