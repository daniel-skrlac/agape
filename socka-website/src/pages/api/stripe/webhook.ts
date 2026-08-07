import type { APIRoute } from 'astro';
import { getDonationConfig } from '../../../lib/donations/config';
import { donationJson, enforceRateLimit, handleDonationApiError, DonationApiError } from '../../../lib/donations/http';
import { processStripeWebhookEvent } from '../../../lib/donations/status-store';
import { constructStripeWebhookEvent } from '../../../lib/donations/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    enforceRateLimit(request, 'stripe-webhook', 120);

    const rawBody = await request.text();
    if (rawBody.length > 1_000_000) {
      throw new DonationApiError(413, 'webhook_too_large', 'Webhook je prevelik.');
    }

    const event = constructStripeWebhookEvent(
      getDonationConfig(),
      rawBody,
      request.headers.get('stripe-signature')
    );
    const result = processStripeWebhookEvent(event);

    return donationJson({
      received: true,
      processed: result.processed,
      duplicate: result.duplicate
    });
  } catch (error) {
    return handleDonationApiError(error);
  }
};
