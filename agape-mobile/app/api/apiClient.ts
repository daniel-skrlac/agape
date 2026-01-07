import type { ServiceResponseDTO } from "../models/generated";

export class ApiError extends Error {
    status: number;
    body?: unknown;

    constructor(message: string, status: number, body?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type TokenProvider = () => Promise<string | null>;

type RequestOptions = {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined | null>;
    signal?: AbortSignal;
    timeoutMs?: number;
    unwrapServiceResponse?: boolean;
    parseDates?: boolean;
};

type ApiClientConfig = {
    baseUrl: string;
    getToken?: TokenProvider;
    onUnauthorized?: () => Promise<void> | void;
};

export function createApiClient(config: ApiClientConfig) {
    const { baseUrl, getToken, onUnauthorized } = config;

    async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const {
            method = "GET",
            body,
            headers: customHeaders,
            query,
            signal,
            timeoutMs = 20_000,
            unwrapServiceResponse = true,
            parseDates = true,
        } = options;

        const url = buildUrl(baseUrl, path, query);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const combinedSignal = mergeSignals(signal, controller.signal);

        try {
            const token = getToken ? await getToken() : null;

            const headers: Record<string, string> = {
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(customHeaders ?? {}),
            };

            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: combinedSignal,
            });

            const text = await res.text();
            const json = text ? safeJsonParse(text, parseDates) : null;

            if (res.status === 401 || res.status === 403) {
                await onUnauthorized?.();
            }

            if (!res.ok) {
                throw new ApiError(`HTTP ${res.status}`, res.status, json);
            }

            if (!unwrapServiceResponse) {
                return json as T;
            }

            const envelope = json as ServiceResponseDTO<T>;

            if (envelope && typeof envelope === "object" && "success" in envelope) {
                if (!envelope.success) {
                    const sc = envelope.statusCode ?? res.status;
                    if (sc === 401 || sc === 403) {
                        await onUnauthorized?.();
                    }

                    throw new ApiError(envelope.message || "Request failed", sc, envelope);
                }
                return envelope.data;
            }

            return json as T;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return { request };
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]) {
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const url = new URL(`${normalizedBase}${normalizedPath}`);

    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null) continue;
            url.searchParams.set(k, String(v));
        }
    }

    return url.toString();
}

function safeJsonParse(text: string, parseDates: boolean) {
    if (!parseDates) return JSON.parse(text);

    return JSON.parse(text, (key, value) => {
        if (typeof value === "string" && isIsoDateString(value) && isLikelyDateKey(key)) {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) return d;
        }
        return value;
    });
}

function isIsoDateString(s: string) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:\d{2})$/.test(s);
}

function isLikelyDateKey(key: string) {
    return /(At|Date)$/i.test(key);
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal) {
    if (!a) return b;
    if (!b) return a;

    const controller = new AbortController();
    const onAbort = () => controller.abort();

    if (a.aborted || b.aborted) controller.abort();
    else {
        a.addEventListener("abort", onAbort, { once: true });
        b.addEventListener("abort", onAbort, { once: true });
    }

    return controller.signal;
}
