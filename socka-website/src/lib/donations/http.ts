import type { DonationConfig } from './config';

export class DonationApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const donationJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

export function handleDonationApiError(error: unknown) {
  if (error instanceof DonationApiError) {
    return donationJson(
      {
        ok: false,
        code: error.code,
        message: error.message
      },
      error.status
    );
  }

  if (import.meta.env.DEV) {
    console.error('[donations] Unexpected API error', error);
  }

  return donationJson(
    {
      ok: false,
      code: 'unexpected_error',
      message: 'Dogodila se pogreška. Pokušajte ponovno za nekoliko trenutaka.'
    },
    500
  );
}

export function assertAllowedOrigin(request: Request, config: DonationConfig) {
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const forwardedProto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '');
  const host = request.headers.get('host');
  const hostOrigin = host ? `${forwardedProto}://${host}` : requestOrigin;
  const allowedOrigins = new Set([requestOrigin, hostOrigin, new URL(config.siteUrl).origin]);

  if (!origin) {
    if (import.meta.env.DEV) return;
    throw new DonationApiError(403, 'missing_origin', 'Zahtjev nije prošao sigurnosnu provjeru izvora.');
  }

  if (!allowedOrigins.has(origin)) {
    throw new DonationApiError(403, 'invalid_origin', 'Zahtjev nije poslan s dopuštene stranice.');
  }
}

export async function parseJsonBody<T = Record<string, unknown>>(request: Request, maxBytes = 12_000): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new DonationApiError(415, 'invalid_content_type', 'Zahtjev mora biti poslan kao JSON.');
  }

  const body = await request.text();
  if (body.length > maxBytes) {
    throw new DonationApiError(413, 'request_too_large', 'Zahtjev je prevelik.');
  }

  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Body is not an object');
    }
    return parsed as T;
  } catch {
    throw new DonationApiError(400, 'invalid_json', 'Zahtjev nije ispravan JSON.');
  }
}

export function enforceRateLimit(request: Request, routeKey: string, limit = 30, windowMs = 60_000) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || request.headers.get('x-real-ip') || 'local';
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new DonationApiError(429, 'rate_limited', 'Previše pokušaja. Pričekajte trenutak pa pokušajte ponovno.');
  }
}

export function readIdempotencyKey(body: Record<string, unknown>, prefix: string) {
  const raw = body.idempotencyKey;
  const safe = typeof raw === 'string' && /^[a-zA-Z0-9:_-]{12,120}$/.test(raw) ? raw : crypto.randomUUID();
  return `${prefix}:${safe}`;
}
