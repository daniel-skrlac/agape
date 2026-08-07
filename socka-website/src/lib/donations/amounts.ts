export const DEFAULT_DONATION_AMOUNTS_CENTS = [500, 1000, 2000, 5000] as const;

export interface AmountValidationOptions {
  minAmountCents: number;
  maxAmountCents: number;
}

export interface ValidAmount {
  ok: true;
  cents: number;
}

export interface InvalidAmount {
  ok: false;
  code:
    | 'missing'
    | 'invalid_format'
    | 'not_integer'
    | 'zero'
    | 'negative'
    | 'too_low'
    | 'too_high';
  message: string;
}

export type AmountValidationResult = ValidAmount | InvalidAmount;

export const formatEuro = (amountCents: number) =>
  `${(amountCents / 100).toLocaleString('hr-HR', {
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })} €`;

export const donationAmountOptions = DEFAULT_DONATION_AMOUNTS_CENTS.map((cents) => ({
  cents,
  label: formatEuro(cents),
  monthlyLabel: `${formatEuro(cents)} mjesečno`
}));

export function parseEuroAmountToCents(input: unknown): AmountValidationResult {
  if (typeof input !== 'string') {
    return {
      ok: false,
      code: 'missing',
      message: 'Unesite iznos u eurima.'
    };
  }

  const value = input.trim();
  if (!value) {
    return {
      ok: false,
      code: 'missing',
      message: 'Unesite iznos u eurima.'
    };
  }

  if (!/^\d+(?:[,.]\d{1,2})?$/.test(value)) {
    return {
      ok: false,
      code: 'invalid_format',
      message: 'Unesite iznos u eurima, npr. 10 ili 10,50.'
    };
  }

  const [euroPart, centPart = ''] = value.replace(',', '.').split('.');
  const euros = Number(euroPart);
  const cents = Number(`${centPart}00`.slice(0, 2));
  const amountCents = euros * 100 + cents;

  if (!Number.isSafeInteger(amountCents)) {
    return {
      ok: false,
      code: 'not_integer',
      message: 'Iznos nije moguće obraditi. Pokušajte s manjim iznosom.'
    };
  }

  return validatePositiveAmount(amountCents);
}

export function validatePositiveAmount(amountCents: number): AmountValidationResult {
  if (!Number.isSafeInteger(amountCents)) {
    return {
      ok: false,
      code: 'not_integer',
      message: 'Iznos mora biti zapisan u centima.'
    };
  }

  if (amountCents < 0) {
    return {
      ok: false,
      code: 'negative',
      message: 'Iznos ne može biti negativan.'
    };
  }

  if (amountCents === 0) {
    return {
      ok: false,
      code: 'zero',
      message: 'Iznos mora biti veći od 0 €.'
    };
  }

  return {
    ok: true,
    cents: amountCents
  };
}

export function validateConfiguredAmount(amountCents: unknown, options: AmountValidationOptions): AmountValidationResult {
  if (typeof amountCents !== 'number') {
    return {
      ok: false,
      code: 'missing',
      message: 'Odaberite iznos donacije.'
    };
  }

  const positive = validatePositiveAmount(amountCents);
  if (!positive.ok) return positive;

  if (positive.cents < options.minAmountCents) {
    return {
      ok: false,
      code: 'too_low',
      message: `Najmanji iznos je ${formatEuro(options.minAmountCents)}.`
    };
  }

  if (positive.cents > options.maxAmountCents) {
    return {
      ok: false,
      code: 'too_high',
      message: `Najveći iznos je ${formatEuro(options.maxAmountCents)}.`
    };
  }

  return positive;
}
