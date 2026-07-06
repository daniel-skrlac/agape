import Strings from "@/src/constants/Strings";
import type { ServiceResponseDTO } from "../../src/models/generated";

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get userMessage(): string {
    const b: any = this.body;
    const msg =
      b?.message ??
      b?.error ??
      b?.detail ??
      (typeof b === "string" ? b : null);

    if (msg) return normalizeUserMessage(String(msg));

    if (this.status === 0) return "Ne mogu se spojiti na poslužitelj. Provjeri mrežu i pokušaj ponovno.";
    if (this.status === 401 || this.status === 403) return "Niste ovlašteni.";
    return normalizeUserMessage(this.message || `HTTP ${this.status}`);
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super("Zahtjev je prekinut.");
    this.name = "RequestCancelledError";
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

export function toUserMessage(e: unknown, fallback = Strings.auth.errors.generic) {
  if (isRequestCancelled(e)) return "";
  if (e instanceof ApiError) return e.userMessage || fallback;
  if (e instanceof Error) return normalizeUserMessage(e.message || fallback);
  if (typeof e === "string") return normalizeUserMessage(e) || fallback;
  return fallback;
}

export function isRequestCancelled(e: unknown) {
  if (!e) return false;
  if (e instanceof RequestCancelledError) return true;
  const anyError = e as any;
  const name = String(anyError?.name ?? "").toLowerCase();
  const code = String(anyError?.code ?? "").toLowerCase();
  const message = String(anyError?.message ?? anyError ?? "").toLowerCase();
  return (
    name === "aborterror" ||
    name === "cancelederror" ||
    name === "cancellederror" ||
    name === "requestcancellederror" ||
    code === "err_canceled" ||
    message === "aborted" ||
    message === "aborterror" ||
    message.includes("request aborted") ||
    message.includes("request cancelled") ||
    message.includes("request canceled") ||
    message.includes("zahtjev je prekinut")
  );
}

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
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

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
      const json = parseResponseBody(text, parseDates);

      if (res.status === 401 || res.status === 403) {
        await onUnauthorized?.();
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          if (json && typeof json === "object") {
            const m =
              (json as any).message ??
              (json as any).error ??
              (json as any).detail ??
              null;
            if (m) msg = String(m);
          }
        } catch {
        }

        throw new ApiError(msg, res.status, json);
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
          throw new ApiError(envelope.message || "Zahtjev nije uspio.", sc, envelope);
        }
        return envelope.data;
      }

      return json as T;
    } catch (e) {
      throw normalizeRequestFailure(e, timedOut, signal);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function upload<T>(
    path: string,
    formData: FormData,
    options: Omit<RequestOptions, "body" | "method"> = {}
  ): Promise<T> {
    const {
      query,
      signal,
      timeoutMs = 60_000,
      unwrapServiceResponse = true,
      parseDates = true,
    } = options;

    const url = buildUrl(baseUrl, path, query);
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const combinedSignal = mergeSignals(signal, controller.signal);

    try {
      const token = getToken ? await getToken() : null;

      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: combinedSignal,
      });

      const text = await res.text();
      const json = parseResponseBody(text, parseDates);

      if (res.status === 401 || res.status === 403) {
        await onUnauthorized?.();
      }

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        if (json && typeof json === "object") {
          const m =
            (json as any).message ??
            (json as any).error ??
            (json as any).detail ??
            null;
          if (m) msg = String(m);
        }
        if (msg === `HTTP ${res.status}` && typeof json === "string" && json.trim()) {
          msg = trimResponseText(json);
        }
        throw new ApiError(msg, res.status, json);
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
          throw new ApiError(envelope.message || "Zahtjev nije uspio.", sc, envelope);
        }
        return envelope.data;
      }

      if (typeof json === "string") {
        throw new ApiError(json || "Neočekivan odgovor kod učitavanja.", res.status, json);
      }

      return json as T;
    } catch (e) {
      throw normalizeRequestFailure(e, timedOut, signal);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { request, upload };
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

function parseResponseBody(text: string, parseDates: boolean) {
  if (!text) return null;
  try {
    return safeJsonParse(text, parseDates);
  } catch {
    return trimResponseText(text);
  }
}

function trimResponseText(text: string) {
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Server je vratio nečitljiv odgovor.";
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function normalizeRequestFailure(e: unknown, timedOut: boolean, userSignal?: AbortSignal) {
  if (isRequestCancelled(e)) {
    if (timedOut && !userSignal?.aborted) {
      return new ApiError("Zahtjev je istekao. Provjeri vezu i pokušaj ponovno.", 0, null);
    }
    return new RequestCancelledError();
  }

  if (isAbortLikeError(e)) {
    if (timedOut && !userSignal?.aborted) {
      return new ApiError("Zahtjev je istekao. Provjeri vezu i pokušaj ponovno.", 0, null);
    }
    return new RequestCancelledError();
  }

  return e;
}

function isAbortLikeError(e: unknown) {
  if (!e) return false;
  const anyError = e as any;
  const name = String(anyError?.name ?? "").toLowerCase();
  const message = String(anyError?.message ?? anyError ?? "").toLowerCase();
  return name === "aborterror" || message === "aborted";
}

function normalizeUserMessage(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned) return cleaned;
  if (isRequestCancelled(cleaned)) return "";
  if (
    lower === "network request failed" ||
    lower === "failed to fetch" ||
    lower === "load failed" ||
    lower.includes("networkerror when attempting to fetch resource")
  ) {
    return "Ne mogu se spojiti na poslužitelj. Provjeri mrežu i pokušaj ponovno.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Zahtjev je istekao. Pokušaj ponovno.";
  }
  if (lower.includes("server returned an unreadable response")) {
    return "Server je vratio nečitljiv odgovor.";
  }
  return translateCommonBackendMessage(cleaned, lower);
}

function translateCommonBackendMessage(message: string, lower: string) {
  if (lower === "invalid credentials.") return "Neispravno korisničko ime ili lozinka.";
  if (lower.includes("username already taken")) return "Korisničko ime je već zauzeto.";
  if (lower.includes("name cannot be empty")) return "Ime ne smije biti prazno.";
  if (lower.includes("username cannot be empty")) return "Korisničko ime ne smije biti prazno.";
  if (lower.includes("password cannot be empty")) return "Lozinka ne smije biti prazna.";

  if (lower.includes("failed to load stock statistics")) return "Ne mogu učitati statistiku.";
  if (lower.includes("failed to load warehouses")) return "Ne mogu učitati skladišta.";
  if (lower.includes("failed to load document types")) return "Ne mogu učitati vrste dokumenata.";
  if (lower.includes("failed to search items")) return "Ne mogu pretražiti artikle.";
  if (lower.includes("failed to search partners")) return "Ne mogu pretražiti partnere.";
  if (lower.includes("failed to list templates")) return "Ne mogu učitati predloške.";
  if (lower.includes("failed to fetch template")) return "Ne mogu učitati predložak.";
  if (lower.includes("failed to save template document")) return "Ne mogu spremiti dokument predloška.";
  if (lower.includes("failed to replace template items")) return "Ne mogu spremiti stavke dokumenta.";
  if (lower.includes("template booking failed")) return "Knjiženje predloška nije uspjelo.";
  if (lower.includes("failed to finalize session")) return "Knjiženje evidencije nije uspjelo.";

  if (lower.includes("warehouseid is required") || lower.includes("warehouseid missing")) return "Odaberi skladište.";
  if (lower.includes("documentid is required")) return "Odaberi dokument.";
  if (lower.includes("items missing")) return "Nedostaju stavke.";
  if (lower.includes("request is null")) return "Zahtjev nije ispravan.";
  if (lower.includes("no valid quantities")) return "Unesi barem jednu pozitivnu količinu.";

  if (lower.includes("template document not found")) return "Dokument predloška nije pronađen.";
  if (lower.includes("template not found")) return "Predložak nije pronađen.";
  if (lower.includes("template not accessible")) return "Predložak nije dostupan.";
  if (lower.includes("template has no documents")) return "Predložak nema dokumente.";
  if (lower.includes("template or standalone items are required")) return "Odaberi predložak ili dodaj stavke.";
  if (lower.includes("parent folder not found")) return "Nadređena mapa nije pronađena.";
  if (lower.includes("folder not found")) return "Mapa nije pronađena.";

  if (lower.includes("session not found")) return "Evidencija nije pronađena.";
  if (lower.includes("session is not editable")) return "Evidencija više nije u draftu.";
  if (lower.includes("session cannot be finalized")) return "Evidencija se ne može zaključiti.";
  if (lower.includes("session has no entries")) return "Evidencija nema unosa.";
  if (lower.includes("entry not found")) return "Unos nije pronađen.";

  if (lower.includes("partner") && lower.includes("not found")) return "Partner nije pronađen.";
  if (lower.includes("user not found")) return "Korisnik nije pronađen.";
  if (lower.includes("invalid user")) return "Korisnik nije ispravan.";

  if (lower.includes("file is required")) return "Odaberi sliku otpremnice.";
  if (lower.includes("unsupported file type")) return "Format datoteke nije podržan.";
  if (lower.includes("failed to parse scan")) return "Ne mogu analizirati otpremnicu.";
  if (lower.includes("failed to validate scan entry")) return "Ne mogu provjeriti skenirani unos.";
  if (lower.includes("failed to save scan entry")) return "Ne mogu spremiti skenirani unos.";

  return message;
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
