import type { APIRoute } from 'astro';
import { formatEuro } from '../../../lib/donations/amounts';
import { getDonationConfig } from '../../../lib/donations/config';
import { donationJson, enforceRateLimit, handleDonationApiError, DonationApiError } from '../../../lib/donations/http';
import { getCheckoutSessionStatus } from '../../../lib/donations/stripe';

export const prerender = false;

const toPublicState = (status: Awaited<ReturnType<typeof getCheckoutSessionStatus>>) => {
  if (status.status === 'expired') return 'canceled';
  if (status.paymentStatus === 'paid') return 'confirmed';
  if (status.status === 'complete') return 'pending';
  if (status.status === 'open') return 'pending';
  return 'pending';
};

export const GET: APIRoute = async ({ request }) => {
  try {
    enforceRateLimit(request, 'session-status', 60);

    const sessionId = new URL(request.url).searchParams.get('session_id');
    if (!sessionId) {
      throw new DonationApiError(400, 'missing_session_id', 'Nedostaje identifikator donacije.');
    }

    const status = await getCheckoutSessionStatus(getDonationConfig(), sessionId);

    return donationJson({
      ok: true,
      state: toPublicState(status),
      session: {
        id: status.id,
        mode: status.mode,
        status: status.status,
        paymentStatus: status.paymentStatus,
        donationType: status.donationType,
        amountLabel: typeof status.amountTotal === 'number' ? formatEuro(status.amountTotal) : null,
        currency: status.currency
      }
    });
  } catch (error) {
    return handleDonationApiError(error);
  }
};
