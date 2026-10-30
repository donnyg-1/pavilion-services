"use client";

import { useEffect, useState } from "react";
import type { Appearance, Stripe } from "@stripe/stripe-js";
// The /pure entry only fetches Stripe.js when loadStripe is called, so test mode never loads it.
import { loadStripe } from "@stripe/stripe-js/pure";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { cx, Icon } from "@/components/ui";
import type { Contact } from "./actions";

/** Saves the card against a SetupIntent. Resolves to a reference finalizeBooking can verify. */
export type SaveCard = (clientSecret: string, returnUrl: string, who: Contact) => Promise<{ ref: string } | { error: string }>;
export type CardDriver = { validate: () => Promise<string | null>; save: SaveCard };

let stripePromise: { key: string; promise: Promise<Stripe | null> } | null = null;
function getStripe(key: string) {
  if (stripePromise?.key !== key) stripePromise = { key, promise: loadStripe(key) };
  return stripePromise.promise;
}

const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#1f4d3a",
    colorText: "#1b2420",
    colorDanger: "#b4412f",
    fontFamily: "'Public Sans', system-ui, sans-serif",
    fontSizeBase: "16px",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: { ".Input": { border: "1px solid #e3e8de", boxShadow: "none", padding: "12px 14px" }, ".Input:focus": { borderColor: "#2a624a", boxShadow: "0 0 0 4px rgba(42,98,74,0.1)" } },
};
const fonts = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&display=swap" }];

// ─── Apple Pay / Google Pay ─────────────────────────────────────────────────

export function StripeWallet({ publishableKey, onDetails, onAvailability }: { publishableKey: string; onDetails: (who: Contact, save: SaveCard) => Promise<boolean>; onAvailability: (shown: boolean) => void }) {
  return (
    <Elements stripe={getStripe(publishableKey)} options={{ mode: "setup", currency: "usd", appearance, fonts }}>
      <WalletButton onDetails={onDetails} onAvailability={onAvailability} />
    </Elements>
  );
}

function WalletButton({ onDetails, onAvailability }: { onDetails: (who: Contact, save: SaveCard) => Promise<boolean>; onAvailability: (shown: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  return (
    <ExpressCheckoutElement
      options={{ buttonHeight: 52, buttonType: { applePay: "book", googlePay: "book" }, paymentMethods: { link: "never", amazonPay: "never", paypal: "never" }, layout: { maxColumns: 1, overflow: "never" } }}
      onReady={({ availablePaymentMethods }) => onAvailability(!!availablePaymentMethods && Object.values(availablePaymentMethods).some(Boolean))}
      // The wallet hands over everything the booking needs, so most people never type.
      onClick={(event) => event.resolve({ emailRequired: true, phoneNumberRequired: true, billingAddressRequired: true })}
      onConfirm={async (event) => {
        if (!stripe || !elements) return event.paymentFailed({ reason: "fail" });
        const { error: submitError } = await elements.submit();
        if (submitError) return event.paymentFailed({ reason: "fail", message: submitError.message });
        const d = event.billingDetails;
        const who: Contact = { name: d?.name ?? "", email: d?.email ?? "", phone: d?.phone ?? "", street: d?.address?.line1 ?? "", unit: d?.address?.line2 ?? "" };
        const ok = await onDetails(who, async (clientSecret, returnUrl) => {
          const { error, setupIntent } = await stripe.confirmSetup({ elements, clientSecret, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
          return error || !setupIntent ? { error: error?.message ?? "Your card wasn't saved." } : { ref: setupIntent.id };
        });
        // Closes the wallet sheet; the page explains what to fix.
        if (!ok) event.paymentFailed({ reason: "fail" });
      }}
    />
  );
}

export function MockWallet({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={onClick} disabled={busy} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-black text-[17px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        <Icon name="card" className="size-5" />
        {busy ? "Booking…" : "Book with test wallet"}
      </button>
      <p className="text-center text-xs text-muted">Stands in for Apple Pay / Google Pay until Stripe keys are set. Fills in a sample neighbor.</p>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function StripeCard({ publishableKey, register }: { publishableKey: string; register: (d: CardDriver) => void }) {
  return (
    <Elements stripe={getStripe(publishableKey)} options={{ mode: "setup", currency: "usd", allowedPaymentMethodTypes: ["card"], appearance, fonts }}>
      <CardField register={register} />
    </Elements>
  );
}

function CardField({ register }: { register: (d: CardDriver) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  useEffect(() => {
    if (!stripe || !elements) return;
    register({
      async validate() {
        const { error } = await elements.submit();
        return error?.message ?? null;
      },
      async save(clientSecret, returnUrl, who) {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          clientSecret,
          redirect: "if_required",
          confirmParams: { return_url: returnUrl, payment_method_data: { billing_details: { name: who.name, email: who.email, phone: who.phone } } },
        });
        return error || !setupIntent ? { error: error?.message ?? "Your card wasn't saved." } : { ref: setupIntent.id };
      },
    });
  }, [stripe, elements, register]);
  return <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" }, fields: { billingDetails: { name: "never", email: "never", phone: "never" } } }} />;
}

const MOCK_CARDS = [
  { id: "pm_mock_ok", label: "Visa 4242", hint: "Charges succeed" },
  { id: "pm_mock_auth", label: "Visa 3155", hint: "Bank approval needed later" },
  { id: "pm_mock_decline", label: "Mastercard 0341", hint: "Declined later" },
];

export function MockCard({ register }: { register: (d: CardDriver) => void }) {
  const [pm, setPm] = useState(MOCK_CARDS[0].id);
  useEffect(() => {
    register({ validate: async () => null, save: async () => ({ ref: pm }) });
  }, [pm, register]);
  return (
    <div className="rounded-xl border border-dashed border-sage-300 bg-sage-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon name="card" className="size-4" /> Test card (Stripe&apos;s card field appears here once keys are set)
      </p>
      <div id="card" className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Test card">
        {MOCK_CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={pm === c.id}
            onClick={() => setPm(c.id)}
            className={cx("rounded-lg border px-3 py-2 text-left text-sm transition", pm === c.id ? "border-pine-600 bg-white ring-2 ring-pine-600/15" : "border-line bg-white/60 hover:border-sage-300")}
          >
            <span className="block font-semibold">{c.label}</span>
            <span className="block text-xs text-muted">{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
