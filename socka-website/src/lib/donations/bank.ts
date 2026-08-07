import * as bwipjs from 'bwip-js';
import { toDataURL } from 'qrcode';
import { formatEuro } from './amounts';
import type { DonationConfig } from './config';

export interface BankCodeResult {
  amountCents: number;
  amountLabel: string;
  bankName: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  iban: string;
  description: string;
  model: string;
  reference: string;
  purposeCode: string;
  hub3Payload: string;
  pdf417Svg: string;
  pdf417DataUrl: string;
  qrUrl: string;
  qrDataUrl: string;
  downloadName: string;
}

const sanitizeHubLine = (value = '', maxLength = 70) =>
  value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const buildDonationUrl = (config: DonationConfig, amountCents: number) => {
  const url = new URL('/doniraj/', config.siteUrl);
  url.searchParams.set('iznos', String(amountCents));
  url.searchParams.set('nacin', 'online');
  return url.toString();
};

export function buildHub3Payload(config: DonationConfig, amountCents: number) {
  if (!config.bank.enabled) {
    throw new Error(`Bank transfer configuration is incomplete: ${config.bank.missing.join(', ')}`);
  }

  const amount = String(amountCents).padStart(15, '0');

  return [
    'HRVHUB30',
    'EUR',
    amount,
    '',
    '',
    '',
    sanitizeHubLine(config.bank.recipientName),
    sanitizeHubLine(config.bank.recipientAddress),
    sanitizeHubLine(config.bank.recipientCity),
    sanitizeHubLine(config.bank.iban),
    sanitizeHubLine(config.bank.model),
    sanitizeHubLine(config.bank.reference),
    sanitizeHubLine(config.bank.purposeCode),
    sanitizeHubLine(config.bank.description, 140)
  ].join('\n');
}

export async function createBankCode(config: DonationConfig, amountCents: number): Promise<BankCodeResult> {
  const hub3Payload = buildHub3Payload(config, amountCents);
  const pdf417Svg = bwipjs.toSVG({
    bcid: 'pdf417',
    text: hub3Payload,
    scale: 2,
    paddingwidth: 8,
    paddingheight: 8,
    backgroundcolor: 'FFFFFF'
  });
  const qrUrl = buildDonationUrl(config, amountCents);
  const qrDataUrl = await toDataURL(qrUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: {
      dark: '#2a1734',
      light: '#ffffff'
    }
  });

  return {
    amountCents,
    amountLabel: formatEuro(amountCents),
    bankName: config.bank.bankName || '',
    recipientName: config.bank.recipientName || '',
    recipientAddress: config.bank.recipientAddress || '',
    recipientCity: config.bank.recipientCity || '',
    iban: config.bank.iban || '',
    description: config.bank.description || '',
    model: config.bank.model || '',
    reference: config.bank.reference || '',
    purposeCode: config.bank.purposeCode || '',
    hub3Payload,
    pdf417Svg,
    pdf417DataUrl: `data:image/svg+xml;base64,${Buffer.from(pdf417Svg).toString('base64')}`,
    qrUrl,
    qrDataUrl,
    downloadName: `hub3-uplata-${amountCents}.svg`
  };
}
