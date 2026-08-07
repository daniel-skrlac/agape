import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import { DonationApiError } from './http';
import { formatEuro } from './amounts';
import type { DonationConfig } from './config';
import { getRememberedDonationStatus } from './status-store';

let stripeClient: Stripe | undefined;
let stripeClientKey: string | undefined;

const MONTHLY_PRODUCT_EXPECTED = {
  name: 'Mjesečna donacija',
  description: 'Mjesečna donacija Socijalnoj samoposluzi',
  statementDescriptor: 'SOCKA DONACIJA'
} as const;

const MONTHLY_CONFIGURATION_MESSAGE = 'Mjesečne donacije trenutno nisu ispravno konfigurirane.';
const validatedMonthlyProducts = new Set<string>();
const validatedMonthlyPrices = new Set<string>();

function getStripeClient(config: DonationConfig) {
  if (!config.stripe.secretKey) {
    throw new DonationApiError(503, 'stripe_not_configured', 'Online donacije trenutno nisu dostupne.');
  }

  if (!stripeClient || stripeClientKey !== config.stripe.secretKey) {
    stripeClient = new Stripe(config.stripe.secretKey, {
      appInfo: {
        name: 'Socka Website',
        version: '1.0.0'
      }
    });
    stripeClientKey = config.stripe.secretKey;
  }

  return stripeClient;
}

const stripeSecretFingerprint = (secretKey: string | undefined) =>
  createHash('sha256').update(secretKey || 'missing').digest('hex').slice(0, 16);

const stripeObjectSummary = (error: unknown) => {
  if (!error || typeof error !== 'object') return { type: typeof error };

  const source = error as { type?: unknown; code?: unknown; statusCode?: unknown; message?: unknown };
  return {
    type: typeof source.type === 'string' ? source.type : undefined,
    code: typeof source.code === 'string' ? source.code : undefined,
    statusCode: typeof source.statusCode === 'number' ? source.statusCode : undefined,
    message: typeof source.message === 'string' ? source.message : undefined
  };
};

const logMonthlyStripeError = (code: string, details: Record<string, unknown>) => {
  console.error('[donations] Stripe monthly configuration error', {
    code,
    ...details
  });
};

const throwMonthlyConfigurationError = (code: string, details: Record<string, unknown>): never => {
  logMonthlyStripeError(code, details);
  throw new DonationApiError(503, code, MONTHLY_CONFIGURATION_MESSAGE);
};

const ensureMonthlySecret = (config: DonationConfig) => {
  if (!config.stripe.secretKey) {
    throwMonthlyConfigurationError('stripe_monthly_secret_not_configured', {
      problem: 'Missing STRIPE_SECRET_KEY'
    });
  }
};

const ensureMonthlyProductId = (config: DonationConfig) => {
  const productId = config.stripe.monthlyProductId?.trim();

  if (!productId) {
    return throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'Missing STRIPE_MONTHLY_PRODUCT_ID'
    });
  }

  if (!productId.startsWith('prod_')) {
    return throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'STRIPE_MONTHLY_PRODUCT_ID must start with prod_',
      productId
    });
  }

  return productId;
};

const isDeletedProduct = (product: Stripe.Product | Stripe.DeletedProduct): product is Stripe.DeletedProduct =>
  Boolean('deleted' in product && product.deleted);

const productIdFromStripePrice = (price: Stripe.Price) => {
  if (typeof price.product === 'string') return price.product;
  if (price.product && !('deleted' in price.product)) return price.product.id;
  return undefined;
};

const validateMonthlyProduct = async (stripe: Stripe, config: DonationConfig, productId: string) => {
  const cacheKey = `${stripeSecretFingerprint(config.stripe.secretKey)}:${productId}`;
  if (validatedMonthlyProducts.has(cacheKey)) return;

  const product = await stripe.products.retrieve(productId).catch((error): never =>
    throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'Stripe product could not be retrieved',
      productId,
      stripeError: stripeObjectSummary(error)
    })
  );

  if (isDeletedProduct(product)) {
    throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'Stripe product is deleted',
      productId
    });
  }

  const activeProduct = product as Stripe.Product & { statement_descriptor?: string | null };

  if (activeProduct.id !== productId) {
    throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'Retrieved Stripe product ID does not match STRIPE_MONTHLY_PRODUCT_ID',
      expectedProductId: productId,
      actualProductId: activeProduct.id
    });
  }

  if (!activeProduct.active) {
    throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: 'Stripe product is inactive',
      productId
    });
  }

  const displayWarnings = [
    activeProduct.name !== MONTHLY_PRODUCT_EXPECTED.name
      ? `name expected "${MONTHLY_PRODUCT_EXPECTED.name}", got "${activeProduct.name}"`
      : '',
    activeProduct.description !== MONTHLY_PRODUCT_EXPECTED.description
      ? `description expected "${MONTHLY_PRODUCT_EXPECTED.description}", got "${activeProduct.description || ''}"`
      : '',
    activeProduct.statement_descriptor !== MONTHLY_PRODUCT_EXPECTED.statementDescriptor
      ? `statement_descriptor expected "${MONTHLY_PRODUCT_EXPECTED.statementDescriptor}", got "${activeProduct.statement_descriptor || ''}"`
      : ''
  ].filter(Boolean);

  if (displayWarnings.length > 0) {
    console.warn('[donations] Stripe monthly product display differs from documented Dashboard setup', {
      productId,
      warnings: displayWarnings
    });
  }

  validatedMonthlyProducts.add(cacheKey);
};

const validateMonthlyPrice = async (stripe: Stripe, config: DonationConfig, priceId: string, amountCents: number, productId: string) => {
  if (!priceId.startsWith('price_')) {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Configured monthly Price ID must start with price_',
      priceId,
      amountCents
    });
  }

  const cacheKey = `${stripeSecretFingerprint(config.stripe.secretKey)}:${productId}:${priceId}:${amountCents}`;
  if (validatedMonthlyPrices.has(cacheKey)) return;

  const price = await stripe.prices.retrieve(priceId).catch((error): never =>
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price could not be retrieved',
      priceId,
      amountCents,
      stripeError: stripeObjectSummary(error)
    })
  );

  if (!price.active) {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price is inactive',
      priceId,
      amountCents
    });
  }

  if (price.currency.toLowerCase() !== 'eur') {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price currency is not EUR',
      priceId,
      expectedCurrency: 'eur',
      actualCurrency: price.currency
    });
  }

  if (price.unit_amount !== amountCents) {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price amount does not match configured donation amount',
      priceId,
      expectedAmountCents: amountCents,
      actualAmountCents: price.unit_amount
    });
  }

  if (!price.recurring || price.recurring.interval !== 'month' || price.recurring.interval_count !== 1) {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price is not a monthly recurring price',
      priceId,
      recurring: price.recurring
    });
  }

  const priceProductId = productIdFromStripePrice(price);
  if (priceProductId !== productId) {
    throwMonthlyConfigurationError('stripe_monthly_price_not_configured', {
      problem: 'Stripe price belongs to a different product',
      priceId,
      expectedProductId: productId,
      actualProductId: priceProductId
    });
  }

  validatedMonthlyPrices.add(cacheKey);
};

export function __resetStripeDonationValidationCacheForTests() {
  validatedMonthlyProducts.clear();
  validatedMonthlyPrices.clear();
  stripeClient = undefined;
  stripeClientKey = undefined;
}

const checkoutUrls = (config: DonationConfig) => ({
  successUrl: `${config.siteUrl}/doniraj/uspjeh/?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${config.siteUrl}/doniraj/otkazano/`
});

export async function createOneTimeCheckoutSession(config: DonationConfig, amountCents: number, idempotencyKey: string) {
  if (!config.stripe.oneTimeEnabled) {
    throw new DonationApiError(503, 'stripe_one_time_disabled', 'Jednokratne online donacije trenutno nisu dostupne.');
  }

  const stripe = getStripeClient(config);
  const { successUrl, cancelUrl } = checkoutUrls(config);

  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Donacija - ${formatEuro(amountCents)}`,
              description: 'Jednokratna podrška Socijalnoj samoposluzi "Kruh sv. Antuna" Varaždin'
            },
            unit_amount: amountCents
          },
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      submit_type: 'donate',
      metadata: {
        donation_type: 'one_time',
        amount_cents: String(amountCents)
      }
    },
    { idempotencyKey }
  );
}

export async function createMonthlyCheckoutSession(config: DonationConfig, amountCents: number, idempotencyKey: string) {
  ensureMonthlySecret(config);
  const productIdProblem = config.stripe.missingMonthly.find((problem) => problem.includes('STRIPE_MONTHLY_PRODUCT_ID'));
  if (productIdProblem && !config.stripe.monthlyProductId) {
    throwMonthlyConfigurationError('stripe_monthly_product_not_configured', {
      problem: productIdProblem
    });
  }

  const productId = ensureMonthlyProductId(config);

  if (!config.stripe.monthlyEnabled) {
    if (config.stripe.missingMonthly.length > 0) {
      throwMonthlyConfigurationError('stripe_monthly_not_configured', {
        problem: 'Monthly Stripe donations are disabled by invalid or incomplete configuration',
        missingOrInvalid: config.stripe.missingMonthly
      });
    }

    throw new DonationApiError(503, 'stripe_monthly_disabled', 'Mjesečna podrška trenutno nije dostupna.');
  }

  const stripe = getStripeClient(config);
  const { successUrl, cancelUrl } = checkoutUrls(config);
  const priceId = config.stripe.monthlyPriceIds[amountCents];

  await validateMonthlyProduct(stripe, config, productId);
  if (priceId) {
    await validateMonthlyPrice(stripe, config, priceId, amountCents, productId);
  }

  const monthlyMetadata = {
    donation_type: 'monthly',
    amount_cents: String(amountCents),
    stripe_product_id: productId
  };
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? {
        price: priceId,
        quantity: 1
      }
    : {
        price_data: {
          currency: 'eur',
          product: productId,
          recurring: {
            interval: 'month'
          },
          unit_amount: amountCents
        },
        quantity: 1
      };

  return stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: monthlyMetadata,
      subscription_data: {
        metadata: monthlyMetadata
      }
    },
    { idempotencyKey }
  );
}

export async function getCheckoutSessionStatus(config: DonationConfig, sessionId: string) {
  if (!/^cs_(test|live)_[a-zA-Z0-9]+/.test(sessionId)) {
    throw new DonationApiError(400, 'invalid_session_id', 'Identifikator donacije nije ispravan.');
  }

  const remembered = getRememberedDonationStatus(sessionId);
  const stripe = getStripeClient(config);
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
    currency: session.currency,
    donationType: session.metadata?.donation_type || (session.mode === 'subscription' ? 'monthly' : 'one_time'),
    remembered
  };
}

export function constructStripeWebhookEvent(config: DonationConfig, rawBody: string, signature: string | null) {
  if (!config.stripe.webhookSecret) {
    throw new DonationApiError(503, 'webhook_not_configured', 'Stripe webhook nije konfiguriran.');
  }

  if (!signature) {
    throw new DonationApiError(400, 'missing_signature', 'Nedostaje Stripe potpis.');
  }

  try {
    return getStripeClient(config).webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  } catch (error) {
    const stripeError = error as { type?: unknown };
    if (stripeError.type === 'StripeSignatureVerificationError') {
      throw new DonationApiError(400, 'invalid_signature', 'Stripe potpis nije ispravan.');
    }

    throw error;
  }
}
