// Payments adapter. Uses Stripe when STRIPE_SECRET_KEY is set; otherwise a built-in mock
// that lets you click through the whole flow (including declines and 3DS) without an account.

import { config } from "@/lib/config";
import { stripePayments } from "./stripe";
import { mockPayments } from "./mock";

export type SavedCard = { paymentMethodId: string; brand: string | null; last4: string | null };

export type SetupIntentResult =
  | { status: "succeeded"; bookingId: string | null; card: SavedCard }
  | { status: "pending"; bookingId: string | null };

export type ChargeInput = {
  chargeId: string;
  bookingId: string;
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  description: string;
  receiptEmail: string;
};

export type ChargeResult =
  | { status: "succeeded"; paymentIntentId: string; feeCents: number; feeIsEstimate: boolean }
  | { status: "failed"; paymentIntentId: string | null; code: string; message: string };

export type PaymentSessionResult =
  | { status: "paid"; chargeId: string | null; paymentIntentId: string; feeCents: number; feeIsEstimate: boolean }
  | { status: "open" | "expired"; chargeId: string | null };

export interface Payments {
  mode: "stripe" | "mock";
  ensureCustomer(r: { id: string; email: string; name: string; phone: string; stripeCustomerId: string | null }): Promise<string>;
  /** Saves a card for later off-session charges. The browser confirms it with Stripe Elements. */
  createSetupIntent(input: { bookingId: string; customerId: string; description: string }): Promise<{ id: string; clientSecret: string }>;
  retrieveSetupIntent(id: string): Promise<SetupIntentResult>;
  chargeOffSession(input: ChargeInput): Promise<ChargeResult>;
  /** A Checkout page for a failed off-session charge (decline or card needs authentication). */
  createPaymentSession(input: {
    chargeId: string;
    customerId: string;
    amountCents: number;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }>;
  retrievePaymentSession(id: string): Promise<PaymentSessionResult>;
  refund(input: { paymentIntentId: string; amountCents: number; idempotencyKey: string }): Promise<{ refundId: string }>;
}

export function payments(): Payments {
  return config.paymentsMode() === "stripe" ? stripePayments() : mockPayments;
}
