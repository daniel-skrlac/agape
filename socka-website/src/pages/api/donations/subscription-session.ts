import type { APIRoute } from 'astro';
import { validateConfiguredAmount } from '../../../lib/donations/amounts';
import { getDonationConfig } from '../../../lib/donations/config';
import {
  assertAllowedOrigin,
  donationJson,
  enforceRateLimit,
  handleDonationApiError,
  parseJsonBody,
  readIdempotencyKey,
  DonationApiError
} from '../../../lib/donations/http';
import { createMonthlyCheckoutSession } from '../../../lib/donations/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = getDonationConfig();
    assertAllowedOrigin(request, config);
    enforceRateLimit(request, 'subscription-session', 10);

    const body = await parseJsonBody(request);
    const amount = validateConfiguredAmount(body.amountCents, config);
    if (!amount.ok) {
      throw new DonationApiError(400, amount.code, amount.message);
    }

    const session = await createMonthlyCheckoutSession(
      config,
      amount.cents,
      readIdempotencyKey(body, 'monthly')
    );

    if (!session.url) {
      throw new DonationApiError(502, 'stripe_missing_url', 'Stripe nije vratio sigurnu poveznicu za nastavak.');
    }

    return donationJson({
      ok: true,
      sessionId: session.id,
      checkoutUrl: session.url
    });
  } catch (error) {
    return handleDonationApiError(error);
  }
};
