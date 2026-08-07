import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { donationAmountOptions } from './amounts';
import type { DonationConfig } from './config';
import { DonationApiError } from './http';

const stripeMock = vi.hoisted(() => ({
  checkoutCreate: vi.fn(),
  checkoutRetrieve: vi.fn(),
  productsRetrieve: vi.fn(),
  pricesRetrieve: vi.fn(),
  constructEvent: vi.fn()
}));

vi.mock('stripe', () => ({
  default: vi.fn(function StripeMock() {
    return {
      checkout: {
        sessions: {
          create: stripeMock.checkoutCreate,
          retrieve: stripeMock.checkoutRetrieve
        }
      },
      products: {
        retrieve: stripeMock.productsRetrieve
      },
      prices: {
        retrieve: stripeMock.pricesRetrieve
      },
      webhooks: {
        constructEvent: stripeMock.constructEvent
      }
    };
  })
}));

import {
  __resetStripeDonationValidationCacheForTests,
  constructStripeWebhookEvent,
  createMonthlyCheckoutSession,
  createOneTimeCheckoutSession
} from './stripe';

const configuredProductId = 'prod_monthly_test';
const configuredPriceId = 'price_monthly_10';

const product = (overrides: Record<string, unknown> = {}) => ({
  id: configuredProductId,
  object: 'product',
  active: true,
  deleted: false,
  name: 'Mjesečna donacija',
  description: 'Mjesečna donacija Socijalnoj samoposluzi',
  statement_descriptor: 'SOCKA DONACIJA',
  ...overrides
});

const price = (overrides: Record<string, unknown> = {}) => ({
  id: configuredPriceId,
  object: 'price',
  active: true,
  currency: 'eur',
  unit_amount: 1000,
  recurring: {
    interval: 'month',
    interval_count: 1
  },
  product: configuredProductId,
  ...overrides
});

const donationConfig = (stripeOverrides: Partial<DonationConfig['stripe']> = {}): DonationConfig => ({
  siteUrl: 'https://example.test',
  minAmountCents: 100,
  maxAmountCents: 500000,
  oneTimeAmounts: donationAmountOptions,
  monthlyAmounts: donationAmountOptions,
  stripe: {
    secretKey: 'stripe_secret_placeholder',
    webhookSecret: 'stripe_webhook_placeholder',
    monthlyProductId: configuredProductId,
    oneTimeEnabled: true,
    monthlyEnabled: true,
    monthlyPriceIds: {
      1000: configuredPriceId
    },
    missingOneTime: [],
    missingMonthly: [],
    ...stripeOverrides
  },
  bank: {
    enabled: true,
    bankName: 'Privredna banka Zagreb d.d.',
    recipientName: 'Primatelj Test',
    recipientAddress: 'Testna 1',
    recipientCity: '42000 Varaždin',
    iban: 'HR1210010051863000160',
    description: 'Donacija',
    model: 'HR00',
    purposeCode: 'CHAR',
    missing: []
  }
});

const checkoutPayload = () => stripeMock.checkoutCreate.mock.calls.at(-1)?.[0] as any;
const expectMonthlyConfigError = async (promise: Promise<unknown>, code?: string) => {
  await expect(promise).rejects.toMatchObject({
    status: 503,
    ...(code ? { code } : {})
  });
};

describe('Stripe monthly donation checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStripeDonationValidationCacheForTests();
    stripeMock.checkoutCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.test' });
    stripeMock.productsRetrieve.mockResolvedValue(product());
    stripeMock.pricesRetrieve.mockResolvedValue(price());
  });

  it('uses a configured monthly Price ID for preset donations', async () => {
    await createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:preset');

    const payload = checkoutPayload();
    const lineItem = payload.line_items[0];

    expect(lineItem).toEqual({ price: configuredPriceId, quantity: 1 });
    expect(lineItem.price_data).toBeUndefined();
    expect(payload.metadata).toMatchObject({
      donation_type: 'monthly',
      amount_cents: '1000',
      stripe_product_id: configuredProductId
    });
    expect(payload.subscription_data.metadata).toMatchObject(payload.metadata);
  });

  it('uses dynamic monthly price_data attached to the configured Product for custom donations', async () => {
    await createMonthlyCheckoutSession(donationConfig(), 1300, 'monthly:custom');

    const lineItem = checkoutPayload().line_items[0];

    expect(lineItem).toEqual({
      price_data: {
        currency: 'eur',
        product: configuredProductId,
        recurring: {
          interval: 'month'
        },
        unit_amount: 1300
      },
      quantity: 1
    });
    expect(lineItem.price_data.product_data).toBeUndefined();
    expect(stripeMock.pricesRetrieve).not.toHaveBeenCalled();
  });

  it('falls back to dynamic price_data for preset amounts without a configured Price ID', async () => {
    await createMonthlyCheckoutSession(donationConfig({ monthlyPriceIds: {} }), 1000, 'monthly:preset-dynamic');

    const lineItem = checkoutPayload().line_items[0];

    expect(lineItem.price_data).toMatchObject({
      currency: 'eur',
      product: configuredProductId,
      unit_amount: 1000,
      recurring: {
        interval: 'month'
      }
    });
    expect(lineItem.price_data.product_data).toBeUndefined();
  });

  it('rejects missing and invalid Product IDs without creating Checkout', async () => {
    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(
        donationConfig({ monthlyEnabled: false, monthlyProductId: undefined, missingMonthly: ['STRIPE_MONTHLY_PRODUCT_ID'] }),
        1000,
        'monthly:no-product'
      ),
      'stripe_monthly_product_not_configured'
    );

    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(donationConfig({ monthlyProductId: 'price_wrong_product' }), 1000, 'monthly:bad-product'),
      'stripe_monthly_product_not_configured'
    );

    expect(stripeMock.checkoutCreate).not.toHaveBeenCalled();
  });

  it('rejects missing, deleted and inactive Products before Checkout creation', async () => {
    stripeMock.productsRetrieve.mockRejectedValueOnce({ type: 'StripeInvalidRequestError', code: 'resource_missing' });
    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:missing-product'),
      'stripe_monthly_product_not_configured'
    );

    stripeMock.productsRetrieve.mockResolvedValueOnce(product({ deleted: true }));
    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:deleted-product'),
      'stripe_monthly_product_not_configured'
    );

    stripeMock.productsRetrieve.mockResolvedValueOnce(product({ active: false }));
    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:inactive-product'),
      'stripe_monthly_product_not_configured'
    );

    expect(stripeMock.checkoutCreate).not.toHaveBeenCalled();
  });

  it('warns but continues when returned Product display fields differ', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stripeMock.productsRetrieve.mockResolvedValueOnce(product({ description: 'Drugi opis' }));

    await createMonthlyCheckoutSession(donationConfig({ monthlyPriceIds: {} }), 1300, 'monthly:product-warning');

    expect(warn).toHaveBeenCalledWith(
      '[donations] Stripe monthly product display differs from documented Dashboard setup',
      expect.objectContaining({
        productId: configuredProductId,
        warnings: expect.arrayContaining([expect.stringContaining('description expected')])
      })
    );
    expect(stripeMock.checkoutCreate).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('rejects invalid configured Price details before Checkout creation', async () => {
    const cases = [
      price({ unit_amount: 2000 }),
      price({ currency: 'usd' }),
      price({ recurring: { interval: 'year', interval_count: 1 } }),
      price({ recurring: null }),
      price({ product: 'prod_other' }),
      price({ active: false })
    ];

    for (const invalidPrice of cases) {
      vi.clearAllMocks();
      __resetStripeDonationValidationCacheForTests();
      stripeMock.productsRetrieve.mockResolvedValue(product());
      stripeMock.pricesRetrieve.mockResolvedValue(invalidPrice);

      await expectMonthlyConfigError(
        createMonthlyCheckoutSession(donationConfig(), 1000, `monthly:bad-price-${invalidPrice.currency || 'recurring'}`),
        'stripe_monthly_price_not_configured'
      );
      expect(stripeMock.checkoutCreate).not.toHaveBeenCalled();
    }
  });

  it('rejects configured Price IDs that do not start with price_', async () => {
    await expectMonthlyConfigError(
      createMonthlyCheckoutSession(donationConfig({ monthlyPriceIds: { 1000: 'prod_not_a_price' } }), 1000, 'monthly:bad-price-format'),
      'stripe_monthly_price_not_configured'
    );

    expect(stripeMock.checkoutCreate).not.toHaveBeenCalled();
  });

  it('caches successful Product and Price validations for repeated requests', async () => {
    await createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:cached-1');
    await createMonthlyCheckoutSession(donationConfig(), 1000, 'monthly:cached-2');

    expect(stripeMock.productsRetrieve).toHaveBeenCalledTimes(1);
    expect(stripeMock.pricesRetrieve).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkoutCreate).toHaveBeenCalledTimes(2);
  });

  it('keeps one-time donation Checkout behavior independent from monthly Product setup', async () => {
    await createOneTimeCheckoutSession(donationConfig({ monthlyProductId: undefined }), 500, 'one-time:test');

    const lineItem = checkoutPayload().line_items[0];
    expect(lineItem.price_data.product_data.name).toBe('Donacija - 5 €');
    expect(lineItem.price_data.unit_amount).toBe(500);
    expect(stripeMock.productsRetrieve).not.toHaveBeenCalled();
    expect(stripeMock.pricesRetrieve).not.toHaveBeenCalled();
  });

  it('uses safe public errors for monthly configuration failures', async () => {
    const promise = createMonthlyCheckoutSession(
      donationConfig({ monthlyEnabled: false, monthlyProductId: undefined, missingMonthly: ['STRIPE_MONTHLY_PRODUCT_ID'] }),
      500,
      'monthly:safe-error'
    );

    await expect(promise).rejects.toBeInstanceOf(DonationApiError);
    await expect(promise).rejects.toMatchObject({
      status: 503,
      message: 'Mjesečne donacije trenutno nisu ispravno konfigurirane.'
    });
  });
});

describe('Stripe monthly donation logo asset', () => {
  it('keeps public/stripe_logo.png available as a square PNG for the Stripe Dashboard Product', () => {
    const logo = readFileSync(new URL('../../../public/stripe_logo.png', import.meta.url));
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = logo.readUInt32BE(16);
    const height = logo.readUInt32BE(20);

    expect(logo.subarray(0, 8).equals(pngSignature)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(width).toBe(height);
    expect(logo.length).toBeLessThan(4_000_000);
  });
});

describe('Stripe webhook signature handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStripeDonationValidationCacheForTests();
  });

  it('maps invalid Stripe webhook signatures to a safe 400 API error', () => {
    stripeMock.constructEvent.mockImplementationOnce(() => {
      throw { type: 'StripeSignatureVerificationError' };
    });

    expect(() => constructStripeWebhookEvent(donationConfig(), '{"id":"evt_test"}', 'bad-signature')).toThrow(
      expect.objectContaining({
        status: 400,
        code: 'invalid_signature',
        message: 'Stripe potpis nije ispravan.'
      })
    );
  });
});
