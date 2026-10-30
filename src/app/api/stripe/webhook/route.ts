import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import { syncSetupIntent } from "@/lib/services/booking";
import { syncPaymentSession } from "@/lib/services/charging";

// Stripe → Pavilion. Every handler is idempotent; the browser and redirects call the same code.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return NextResponse.json({ error: `Bad signature: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "setup_intent.succeeded": {
        await syncSetupIntent((event.data.object as Stripe.SetupIntent).id);
        break;
      }
      case "checkout.session.completed": {
        // Recovery payments for failed charges still use Stripe's hosted page.
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "payment") await syncPaymentSession(s.id);
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe] failed handling ${event.type}`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
