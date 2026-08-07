/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_VOLUNTEER_FORM_ENDPOINT?: string;
  readonly PUBLIC_STRIPE_CUSTOMER_PORTAL_URL?: string;
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly STRIPE_ONE_TIME_ENABLED?: string;
  readonly STRIPE_MONTHLY_ENABLED?: string;
  readonly STRIPE_MONTHLY_PRODUCT_ID?: string;
  readonly STRIPE_MONTHLY_PRICE_5?: string;
  readonly STRIPE_MONTHLY_PRICE_10?: string;
  readonly STRIPE_MONTHLY_PRICE_20?: string;
  readonly STRIPE_MONTHLY_PRICE_50?: string;
  readonly DONATION_BANK_TRANSFER_ENABLED?: string;
  readonly DONATION_BANK_NAME?: string;
  readonly DONATION_RECIPIENT_NAME?: string;
  readonly DONATION_RECIPIENT_ADDRESS?: string;
  readonly DONATION_RECIPIENT_CITY?: string;
  readonly DONATION_IBAN?: string;
  readonly DONATION_PAYMENT_DESCRIPTION?: string;
  readonly DONATION_PAYMENT_MODEL?: string;
  readonly DONATION_PAYMENT_REFERENCE?: string;
  readonly DONATION_PURPOSE_CODE?: string;
  readonly DONATION_MIN_AMOUNT_CENTS?: string;
  readonly DONATION_MAX_AMOUNT_CENTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'bwip-js' {
  export interface RenderOptions {
    bcid: string;
    text: string;
    scale?: number;
    paddingwidth?: number;
    paddingheight?: number;
    backgroundcolor?: string;
  }

  export function toSVG(options: RenderOptions): string;
}
