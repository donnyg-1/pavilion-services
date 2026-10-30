import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments/stripe";
import { syncSetupSession } from "@/lib/services/booking";
import { syncPaymentSession } from "@/lib/services/charging";

// Stripe → Pavilion. Every handler is idempotent; the success redirects call the same code.
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
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "setup") await syncSetupSession(s.id);
        if (s.mode === "payment") await syncPaymentSession(s.id);
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const bookingId = s.metadata?.bookingId;
        if (s.mode === "setup" && bookingId) {
          await db.booking.updateMany({ where: { id: bookingId, status: "pending_setup" }, data: { status: "expired" } });
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[stripe] failed handling ${event.type}`, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
