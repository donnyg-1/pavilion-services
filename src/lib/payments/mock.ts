// Mock payments for local click-through without Stripe keys.
// The booking form shows these test cards in place of Stripe's card field:
//   pm_mock_ok      → charges succeed
//   pm_mock_auth    → off-session charge needs authentication (like Stripe's 3DS test card)
//   pm_mock_decline → off-session charge is declined

import { estimateStripeFeeCents } from "@/lib/domain/ledger";
import { publicToken } from "@/lib/tokens";
import type { Payments } from "./index";

export const MOCK_CARDS = {
  pm_mock_ok: { brand: "visa", last4: "4242", label: "Charges succeed" },
  pm_mock_auth: { brand: "visa", last4: "3155", label: "Needs authentication when charged later" },
  pm_mock_decline: { brand: "mastercard", last4: "0341", label: "Declined when charged later" },
} as const;

export const mockPayments: Payments = {
  mode: "mock",

  async ensureCustomer(r) {
    return r.stripeCustomerId ?? `cus_mock_${r.id}`;
  },

  async createSetupIntent(input) {
    return { id: `seti_mock_${input.bookingId}`, clientSecret: `mock_secret_${input.bookingId}` };
  },

  async retrieveSetupIntent() {
    // Mock bookings are confirmed directly by finalizeBooking with the chosen test card.
    return { status: "pending", bookingId: null };
  },

  async chargeOffSession(input) {
    const id = `pi_mock_${publicToken()}`;
    if (input.paymentMethodId === "pm_mock_auth") {
      return { status: "failed", paymentIntentId: id, code: "authentication_required", message: "This card needs the cardholder to approve the payment." };
    }
    if (input.paymentMethodId === "pm_mock_decline") {
      return { status: "failed", paymentIntentId: id, code: "card_declined", message: "Your card was declined." };
    }
    return { status: "succeeded", paymentIntentId: id, feeCents: estimateStripeFeeCents(input.amountCents), feeIsEstimate: true };
  },

  async createPaymentSession(input) {
    return { id: `cs_mock_pay_${input.chargeId}`, url: `/mock-checkout/pay/${input.chargeId}` };
  },

  async retrievePaymentSession() {
    return { status: "open", chargeId: null };
  },

  async refund() {
    return { refundId: `re_mock_${publicToken()}` };
  },
};
