import type { ReactNode } from "react";

/** A deliberately plain, Stripe-ish page so it's obvious this is the test stand-in. */
export function MockShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f6f8fa] px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-lg border border-[#f5c26b] bg-[#fff8e6] px-3 py-2 text-sm text-[#6b4b00]">
          <strong>Test mode.</strong> This stands in for Stripe Checkout because no Stripe key is set. Add <code>STRIPE_SECRET_KEY</code> to use real Stripe test mode.
        </div>
        <div className="rounded-xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
