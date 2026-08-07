import type Stripe from 'stripe';

export interface StoredDonationStatus {
  sessionId: string;
  mode: 'payment' | 'subscription' | 'unknown';
  status: 'complete' | 'open' | 'expired' | 'async_payment_succeeded' | 'async_payment_failed';
  paymentStatus?: string | null;
  updatedAt: number;
}

const processedWebhookEvents = new Set<string>();
const sessionStatuses = new Map<string, StoredDonationStatus>();

const normalizeMode = (mode: Stripe.Checkout.Session.Mode | null): StoredDonationStatus['mode'] =>
  mode === 'payment' || mode === 'subscription' ? mode : 'unknown';

export function rememberDonationStatus(status: StoredDonationStatus) {
  sessionStatuses.set(status.sessionId, status);
}

export function getRememberedDonationStatus(sessionId: string) {
  return sessionStatuses.get(sessionId);
}

export function processStripeWebhookEvent(event: Stripe.Event) {
  if (processedWebhookEvents.has(event.id)) {
    return { processed: false, duplicate: true };
  }

  processedWebhookEvents.add(event.id);

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded' ||
    event.type === 'checkout.session.async_payment_failed' ||
    event.type === 'checkout.session.expired'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    rememberDonationStatus({
      sessionId: session.id,
      mode: normalizeMode(session.mode),
      status:
        event.type === 'checkout.session.async_payment_succeeded'
          ? 'async_payment_succeeded'
          : event.type === 'checkout.session.async_payment_failed'
            ? 'async_payment_failed'
            : event.type === 'checkout.session.expired'
              ? 'expired'
              : session.status || 'open',
      paymentStatus: session.payment_status,
      updatedAt: Date.now()
    });
  }

  return { processed: true, duplicate: false };
}
