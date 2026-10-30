import Stripe from "stripe";
import { estimateStripeFeeCents } from "@/lib/domain/ledger";
import type { ChargeResult, Payments, PaymentSessionResult, SetupSessionResult } from "./index";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** The actual Stripe fee for a succeeded payment intent, falling back to an estimate. */
async function feeFor(paymentIntentId: string, amountCents: number): Promise<{ feeCents: number; feeIsEstimate: boolean }> {
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    if (bt && typeof bt.fee === "number") return { feeCents: bt.fee, feeIsEstimate: false };
  } catch {
    // fall through to the estimate
  }
  return { feeCents: estimateStripeFeeCents(amountCents), feeIsEstimate: true };
}

function cardFrom(pm: Stripe.PaymentMethod | string | null) {
  if (!pm || typeof pm === "string") return { paymentMethodId: typeof pm === "string" ? pm : "", brand: null, last4: null };
  return { paymentMethodId: pm.id, brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null };
}

export function stripePayments(): Payments {
  const s = stripe();
  return {
    mode: "stripe",

    async ensureCustomer(r) {
      if (r.stripeCustomerId) return r.stripeCustomerId;
      const c = await s.customers.create(
        { email: r.email, name: r.name, phone: r.phone, metadata: { residentId: r.id } },
        { idempotencyKey: `customer-${r.id}` },
      );
      return c.id;
    },

    async createSetupSession(input) {
      const session = await s.checkout.sessions.create({
        mode: "setup",
        customer: input.customerId,
        allowed_payment_method_types: ["card"],
        currency: "usd",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        client_reference_id: input.bookingId,
        metadata: { bookingId: input.bookingId, kind: "booking_setup" },
        setup_intent_data: { metadata: { bookingId: input.bookingId }, description: input.dealTitle },
        custom_text: { submit: { message: input.authorizationText } },
      });
      return { id: session.id, url: session.url! };
    },

    async retrieveSetupSession(id): Promise<SetupSessionResult> {
      const session = await s.checkout.sessions.retrieve(id, { expand: ["setup_intent.payment_method"] });
      const bookingId = session.metadata?.bookingId ?? session.client_reference_id ?? null;
      if (session.status !== "complete") return { status: session.status === "expired" ? "expired" : "open", bookingId };
      const si = session.setup_intent as Stripe.SetupIntent;
      return { status: "complete", bookingId, card: cardFrom(si.payment_method as Stripe.PaymentMethod) };
    },

    async chargeOffSession(input): Promise<ChargeResult> {
      try {
        const pi = await s.paymentIntents.create(
          {
            amount: input.amountCents,
            currency: "usd",
            customer: input.customerId,
            payment_method: input.paymentMethodId,
            off_session: true,
            confirm: true,
            description: input.description,
            receipt_email: input.receiptEmail,
            metadata: { chargeId: input.chargeId, bookingId: input.bookingId },
          },
          { idempotencyKey: `charge-${input.chargeId}` },
        );
        if (pi.status === "succeeded") {
          return { status: "succeeded", paymentIntentId: pi.id, ...(await feeFor(pi.id, input.amountCents)) };
        }
        return { status: "failed", paymentIntentId: pi.id, code: pi.status, message: `Payment is ${pi.status.replace(/_/g, " ")}` };
      } catch (err) {
        const e = err as { code?: string; decline_code?: string; message?: string; raw?: { payment_intent?: { id?: string } } };
        return {
          status: "failed",
          paymentIntentId: e.raw?.payment_intent?.id ?? null,
          code: e.decline_code || e.code || "charge_failed",
          message: e.message || "The card couldn't be charged.",
        };
      }
    },

    async createPaymentSession(input) {
      const session = await s.checkout.sessions.create({
        mode: "payment",
        customer: input.customerId,
        allowed_payment_method_types: ["card"],
        currency: "usd",
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: input.amountCents, product_data: { name: input.description } } }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { chargeId: input.chargeId, kind: "charge_recovery" },
        payment_intent_data: { metadata: { chargeId: input.chargeId }, description: input.description },
      });
      return { id: session.id, url: session.url! };
    },

    async retrievePaymentSession(id): Promise<PaymentSessionResult> {
      const session = await s.checkout.sessions.retrieve(id);
      const chargeId = session.metadata?.chargeId ?? null;
      if (session.payment_status !== "paid" || !session.payment_intent) {
        return { status: session.status === "expired" ? "expired" : "open", chargeId };
      }
      const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
      return { status: "paid", chargeId, paymentIntentId: piId, ...(await feeFor(piId, session.amount_total ?? 0)) };
    },

    async refund(input) {
      const r = await s.refunds.create(
        { payment_intent: input.paymentIntentId, amount: input.amountCents },
        { idempotencyKey: input.idempotencyKey },
      );
      return { refundId: r.id };
    },
  };
}
