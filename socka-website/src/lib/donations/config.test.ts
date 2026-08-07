import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDonationConfig, getPublicDonationConfig } from './config';

const stripeEnv = {
  STRIPE_SECRET_KEY: 'stripe_secret_placeholder',
  STRIPE_MONTHLY_ENABLED: 'true',
  STRIPE_MONTHLY_PRODUCT_ID: 'prod_monthly',
  STRIPE_MONTHLY_PRICE_5: 'price_5',
  STRIPE_MONTHLY_PRICE_10: 'price_10',
  STRIPE_MONTHLY_PRICE_20: 'price_20',
  STRIPE_MONTHLY_PRICE_50: 'price_50'
};

describe('donation environment configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps monthly Product and Price IDs server-side and validates their prefixes', () => {
    Object.entries(stripeEnv).forEach(([key, value]) => vi.stubEnv(key, value));

    const config = getDonationConfig();

    expect(config.stripe.monthlyEnabled).toBe(true);
    expect(config.stripe.monthlyProductId).toBe('prod_monthly');
    expect(config.stripe.monthlyPriceIds).toMatchObject({
      500: 'price_5',
      1000: 'price_10',
      2000: 'price_20',
      5000: 'price_50'
    });
  });

  it.each(['123', 'price_123', 'product_123'])('rejects invalid monthly Product ID format: %s', (productId) => {
    Object.entries({ ...stripeEnv, STRIPE_MONTHLY_PRODUCT_ID: productId }).forEach(([key, value]) => vi.stubEnv(key, value));

    const config = getDonationConfig();

    expect(config.stripe.monthlyEnabled).toBe(false);
    expect(config.stripe.monthlyProductId).toBeUndefined();
    expect(config.stripe.missingMonthly).toContain('STRIPE_MONTHLY_PRODUCT_ID must start with prod_');
  });

  it('keeps preset monthly Prices optional but rejects invalid non-empty Price IDs', () => {
    Object.entries({ ...stripeEnv, STRIPE_MONTHLY_PRICE_10: '', STRIPE_MONTHLY_PRICE_20: '20' }).forEach(([key, value]) =>
      vi.stubEnv(key, value)
    );

    const config = getDonationConfig();

    expect(config.stripe.monthlyEnabled).toBe(false);
    expect(config.stripe.monthlyPriceIds[1000]).toBeUndefined();
    expect(config.stripe.monthlyPriceIds[2000]).toBeUndefined();
    expect(config.stripe.missingMonthly).toContain('STRIPE_MONTHLY_PRICE_20 must start with price_');
  });

  it('exposes a Stripe-hosted Customer Portal login link to the donation UI', () => {
    vi.stubEnv('PUBLIC_STRIPE_CUSTOMER_PORTAL_URL', 'https://billing.stripe.com/p/login/test_portal#ignored');

    const config = getPublicDonationConfig();

    expect(config.customerPortalUrl).toBe('https://billing.stripe.com/p/login/test_portal');
  });

  it.each([
    'http://billing.stripe.com/p/login/insecure',
    'https://example.com/p/login/not-stripe',
    'https://billing.stripe.com/not-a-portal'
  ])('does not expose an invalid Customer Portal URL: %s', (portalUrl) => {
    vi.stubEnv('PUBLIC_STRIPE_CUSTOMER_PORTAL_URL', portalUrl);

    expect(getPublicDonationConfig().customerPortalUrl).toBeNull();
  });
});
