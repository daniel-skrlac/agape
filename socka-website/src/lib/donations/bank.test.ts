import { describe, expect, it } from 'vitest';
import { buildHub3Payload, createBankCode } from './bank';
import { donationAmountOptions } from './amounts';
import type { DonationConfig } from './config';

const configuredDonation: DonationConfig = {
  siteUrl: 'https://example.test',
  minAmountCents: 100,
  maxAmountCents: 500000,
  oneTimeAmounts: donationAmountOptions,
  monthlyAmounts: donationAmountOptions,
  stripe: {
    secretKey: 'stripe_secret_placeholder',
    webhookSecret: 'stripe_webhook_placeholder',
    monthlyProductId: 'prod_monthly',
    oneTimeEnabled: true,
    monthlyEnabled: true,
    monthlyPriceIds: {
      500: 'price_5',
      1000: 'price_10'
    },
    missingOneTime: [],
    missingMonthly: []
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
    reference: '2026',
    purposeCode: 'CHAR',
    missing: []
  }
};

describe('HUB3 bank payment payload', () => {
  it('generates the expected official line structure for PDF417', () => {
    const lines = buildHub3Payload(configuredDonation, 1234).split('\n');

    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe('HRVHUB30');
    expect(lines[1]).toBe('EUR');
    expect(lines[2]).toBe('000000000001234');
    expect(lines[6]).toBe('Primatelj Test');
    expect(lines[9]).toBe('HR1210010051863000160');
    expect(lines[13]).toBe('Donacija');
  });

  it('creates readable PDF417 SVG and a separate QR destination', async () => {
    const code = await createBankCode(configuredDonation, 500);

    expect(code.pdf417Svg).toContain('<svg');
    expect(code.pdf417DataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(code.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(code.qrUrl).toBe('https://example.test/doniraj/?iznos=500&nacin=online');
  });
});
