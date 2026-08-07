import type { APIRoute } from 'astro';
import { validateConfiguredAmount } from '../../../lib/donations/amounts';
import { createBankCode } from '../../../lib/donations/bank';
import { getDonationConfig } from '../../../lib/donations/config';
import {
  assertAllowedOrigin,
  donationJson,
  enforceRateLimit,
  handleDonationApiError,
  parseJsonBody,
  DonationApiError
} from '../../../lib/donations/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const config = getDonationConfig();
    assertAllowedOrigin(request, config);
    enforceRateLimit(request, 'bank-code', 20);

    const body = await parseJsonBody(request);
    const amount = validateConfiguredAmount(body.amountCents, config);
    if (!amount.ok) {
      throw new DonationApiError(400, amount.code, amount.message);
    }

    if (!config.bank.enabled) {
      throw new DonationApiError(503, 'bank_transfer_disabled', 'Podaci za brzu uplatu još nisu konfigurirani.');
    }

    const code = await createBankCode(config, amount.cents);

    return donationJson({
      ok: true,
      code
    });
  } catch (error) {
    return handleDonationApiError(error);
  }
};
