import { describe, expect, it } from 'vitest';
import { parseEuroAmountToCents, validateConfiguredAmount } from './amounts';

describe('donation amount validation', () => {
  it('parses Croatian decimal comma amounts into integer cents', () => {
    expect(parseEuroAmountToCents('10,50')).toEqual({ ok: true, cents: 1050 });
    expect(parseEuroAmountToCents('20')).toEqual({ ok: true, cents: 2000 });
  });

  it('rejects invalid, zero and negative custom amounts', () => {
    expect(parseEuroAmountToCents('10,999')).toMatchObject({ ok: false, code: 'invalid_format' });
    expect(parseEuroAmountToCents('0')).toMatchObject({ ok: false, code: 'zero' });
    expect(parseEuroAmountToCents('-5')).toMatchObject({ ok: false, code: 'invalid_format' });
  });

  it('enforces configured minimum and maximum amounts', () => {
    const options = { minAmountCents: 500, maxAmountCents: 5000 };

    expect(validateConfiguredAmount(499, options)).toMatchObject({ ok: false, code: 'too_low' });
    expect(validateConfiguredAmount(5001, options)).toMatchObject({ ok: false, code: 'too_high' });
    expect(validateConfiguredAmount(1000, options)).toEqual({ ok: true, cents: 1000 });
  });
});
