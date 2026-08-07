import { DEFAULT_DONATION_AMOUNTS_CENTS, donationAmountOptions } from './amounts';
import { site } from '../site';

export type DonationMethod = 'one_time' | 'monthly' | 'bank';

interface StripeDonationConfig {
  secretKey?: string;
  webhookSecret?: string;
  customerPortalUrl?: string;
  monthlyProductId?: string;
  oneTimeEnabled: boolean;
  monthlyEnabled: boolean;
  monthlyPriceIds: Record<number, string>;
  missingOneTime: string[];
  missingMonthly: string[];
}

interface BankDonationConfig {
  enabled: boolean;
  bankName?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientCity?: string;
  iban?: string;
  description?: string;
  model?: string;
  reference?: string;
  purposeCode?: string;
  missing: string[];
}

export interface DonationConfig {
  siteUrl: string;
  minAmountCents: number;
  maxAmountCents: number;
  oneTimeAmounts: typeof donationAmountOptions;
  monthlyAmounts: typeof donationAmountOptions;
  stripe: StripeDonationConfig;
  bank: BankDonationConfig;
}

export interface PublicDonationConfig {
  siteUrl: string;
  customerPortalUrl: string | null;
  minAmountCents: number;
  maxAmountCents: number;
  amountOptions: typeof donationAmountOptions;
  methods: {
    oneTime: {
      enabled: boolean;
      unavailableMessage: string;
    };
    monthly: {
      enabled: boolean;
      unavailableMessage: string;
    };
    bank: {
      enabled: boolean;
      unavailableMessage: string;
    };
  };
  messages: {
    stripeTrust: string | null;
    monthlyNotice: string;
    bankNotice: string;
  };
  bankTransfer: {
    bankName: string;
    recipientName: string;
    iban: string;
  };
}

const readEnv = (name: string) => process.env[name] || (import.meta.env as Record<string, string | undefined>)[name];

const readBoolean = (name: string, fallback: boolean) => {
  const value = readEnv(name);
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const readPositiveInteger = (name: string, fallback: number) => {
  const value = Number(readEnv(name));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

const clean = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const normalizeSiteUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:4321';
  }
};

const normalizeStripeCustomerPortalUrl = (value: string | undefined) => {
  const normalized = clean(value);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    const isStripePortal =
      url.protocol === 'https:' &&
      url.hostname === 'billing.stripe.com' &&
      url.pathname.startsWith('/p/login/');

    if (!isStripePortal) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
};

const isValidCroatianIban = (value: string | undefined) => Boolean(value && /^HR\d{19}$/i.test(value.replace(/\s+/g, '')));

const missingWhen = (condition: boolean, label: string) => (condition ? [] : [label]);
const invalidWhen = (condition: boolean, label: string) => (condition ? [] : [label]);

const defaultBankDonation = {
  bankName: 'Privredna banka Zagreb d.d.',
  recipientName: 'Socijalna samoposluga "Kruh sv. Antuna" Varaždin',
  recipientAddress: site.address.street,
  recipientCity: `${site.address.postalCode} ${site.address.city}`,
  iban: 'HR6723400091110609350',
  description: 'Donacija za Socijalnu samoposlugu',
  model: 'HR00',
  purposeCode: 'CHAR'
};

export function getDonationConfig(): DonationConfig {
  const siteUrl = normalizeSiteUrl(readEnv('PUBLIC_SITE_URL') || site.baseUrl);
  const minAmountCents = readPositiveInteger('DONATION_MIN_AMOUNT_CENTS', 100);
  const maxAmountCents = Math.max(
    minAmountCents,
    readPositiveInteger('DONATION_MAX_AMOUNT_CENTS', 500000)
  );

  const stripeSecretKey = clean(readEnv('STRIPE_SECRET_KEY'));
  const stripeWebhookSecret = clean(readEnv('STRIPE_WEBHOOK_SECRET'));
  const customerPortalUrl = normalizeStripeCustomerPortalUrl(readEnv('PUBLIC_STRIPE_CUSTOMER_PORTAL_URL'));
  const oneTimeWanted = readBoolean('STRIPE_ONE_TIME_ENABLED', true);
  const monthlyWanted = readBoolean('STRIPE_MONTHLY_ENABLED', true);
  const monthlyProductIdRaw = clean(readEnv('STRIPE_MONTHLY_PRODUCT_ID'));
  const monthlyProductId = monthlyProductIdRaw?.startsWith('prod_') ? monthlyProductIdRaw : undefined;
  const monthlyProductIdProblems = [
    ...missingWhen(Boolean(monthlyProductIdRaw), 'STRIPE_MONTHLY_PRODUCT_ID'),
    ...(monthlyProductIdRaw ? invalidWhen(monthlyProductIdRaw.startsWith('prod_'), 'STRIPE_MONTHLY_PRODUCT_ID must start with prod_') : [])
  ];
  const monthlyPriceIdProblems: string[] = [];

  const monthlyPriceIds = DEFAULT_DONATION_AMOUNTS_CENTS.reduce<Record<number, string>>((prices, cents) => {
    const euros = cents / 100;
    const priceId = clean(readEnv(`STRIPE_MONTHLY_PRICE_${euros}`));
    if (!priceId) return prices;
    if (!priceId.startsWith('price_')) {
      monthlyPriceIdProblems.push(`STRIPE_MONTHLY_PRICE_${euros} must start with price_`);
      return prices;
    }

    prices[cents] = priceId;
    return prices;
  }, {});

  const bankName = clean(readEnv('DONATION_BANK_NAME')) || defaultBankDonation.bankName;
  const recipientName = clean(readEnv('DONATION_RECIPIENT_NAME')) || defaultBankDonation.recipientName;
  const recipientAddress = clean(readEnv('DONATION_RECIPIENT_ADDRESS')) || defaultBankDonation.recipientAddress;
  const recipientCity = clean(readEnv('DONATION_RECIPIENT_CITY')) || defaultBankDonation.recipientCity;
  const iban = (clean(readEnv('DONATION_IBAN')) || defaultBankDonation.iban).replace(/\s+/g, '').toUpperCase();
  const description = clean(readEnv('DONATION_PAYMENT_DESCRIPTION')) || defaultBankDonation.description;
  const bankWanted = readBoolean('DONATION_BANK_TRANSFER_ENABLED', true);

  const bankMissing = [
    ...missingWhen(Boolean(recipientName), 'DONATION_RECIPIENT_NAME'),
    ...missingWhen(Boolean(recipientAddress), 'DONATION_RECIPIENT_ADDRESS'),
    ...missingWhen(Boolean(recipientCity), 'DONATION_RECIPIENT_CITY'),
    ...missingWhen(isValidCroatianIban(iban), 'DONATION_IBAN'),
    ...missingWhen(Boolean(description), 'DONATION_PAYMENT_DESCRIPTION')
  ];

  return {
    siteUrl,
    minAmountCents,
    maxAmountCents,
    oneTimeAmounts: donationAmountOptions,
    monthlyAmounts: donationAmountOptions,
    stripe: {
      secretKey: stripeSecretKey,
      webhookSecret: stripeWebhookSecret,
      customerPortalUrl,
      monthlyProductId,
      oneTimeEnabled: oneTimeWanted && Boolean(stripeSecretKey),
      monthlyEnabled: monthlyWanted && Boolean(stripeSecretKey) && Boolean(monthlyProductId) && monthlyPriceIdProblems.length === 0,
      monthlyPriceIds,
      missingOneTime: stripeSecretKey ? [] : ['STRIPE_SECRET_KEY'],
      missingMonthly: [
        ...missingWhen(Boolean(stripeSecretKey), 'STRIPE_SECRET_KEY'),
        ...monthlyProductIdProblems,
        ...monthlyPriceIdProblems
      ]
    },
    bank: {
      enabled: bankWanted && bankMissing.length === 0,
      bankName,
      recipientName,
      recipientAddress,
      recipientCity,
      iban,
      description,
      model: clean(readEnv('DONATION_PAYMENT_MODEL')) || defaultBankDonation.model,
      reference: clean(readEnv('DONATION_PAYMENT_REFERENCE')),
      purposeCode: clean(readEnv('DONATION_PURPOSE_CODE')) || defaultBankDonation.purposeCode,
      missing: bankMissing
    }
  };
}

export function getPublicDonationConfig(): PublicDonationConfig {
  const config = getDonationConfig();
  const stripeEnabled = config.stripe.oneTimeEnabled || config.stripe.monthlyEnabled;

  if (import.meta.env.DEV) {
    const missing = [
      ...config.stripe.missingOneTime,
      ...config.stripe.missingMonthly,
      ...config.bank.missing
    ];
    if (missing.length > 0) {
      console.info(`[donations] Missing optional setup: ${[...new Set(missing)].join(', ')}`);
    }
  }

  return {
    siteUrl: config.siteUrl,
    customerPortalUrl: config.stripe.customerPortalUrl || null,
    minAmountCents: config.minAmountCents,
    maxAmountCents: config.maxAmountCents,
    amountOptions: config.oneTimeAmounts,
    methods: {
      oneTime: {
        enabled: config.stripe.oneTimeEnabled,
        unavailableMessage: 'Online donacije uskoro uključujemo. Za sada možete odmah koristiti brzu uplatu.'
      },
      monthly: {
        enabled: config.stripe.monthlyEnabled,
        unavailableMessage: 'Mjesečnu podršku uskoro uključujemo. Za sada možete pomoći jednokratnom uplatom.'
      },
      bank: {
        enabled: config.bank.enabled,
        unavailableMessage: 'Brzu uplatu trenutno ne možemo pripremiti. Javite nam se i poslat ćemo podatke za uplatu.'
      }
    },
    messages: {
      stripeTrust: stripeEnabled ? 'Hvala što birate pomoći. Svaka potvrđena donacija pretvara se u konkretnu podršku.' : null,
      monthlyNotice: 'Odabrani iznos pomaže iz mjeseca u mjesec.',
      bankNotice: 'Prije uplate provjerite primatelja, IBAN i odabrani iznos.'
    },
    bankTransfer: {
      bankName: config.bank.bankName || '',
      recipientName: config.bank.recipientName || '',
      iban: config.bank.iban || ''
    }
  };
}
