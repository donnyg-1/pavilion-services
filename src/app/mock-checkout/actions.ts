"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { MOCK_CARDS } from "@/lib/payments/mock";
import { confirmBooking } from "@/lib/services/booking";
import { recordChargeSuccess } from "@/lib/services/charging";
import { estimateStripeFeeCents } from "@/lib/domain/ledger";

function assertMock() {
  if (config.paymentsMode() !== "mock") throw new Error("Mock checkout is disabled when Stripe is configured");
}

export async function mockSaveCard(token: string, formData: FormData) {
  assertMock();
  const pm = String(formData.get("card")) as keyof typeof MOCK_CARDS;
  const card = MOCK_CARDS[pm] ?? MOCK_CARDS.pm_mock_ok;
  const booking = await db.booking.findUniqueOrThrow({ where: { publicToken: token } });
  await confirmBooking(booking.id, { paymentMethodId: pm in MOCK_CARDS ? pm : "pm_mock_ok", brand: card.brand, last4: card.last4 });
  redirect(`/b/${token}?new=1`);
}

export async function mockPay(chargeId: string) {
  assertMock();
  const charge = await db.charge.findUniqueOrThrow({ where: { id: chargeId }, include: { booking: true } });
  await recordChargeSuccess(chargeId, { paymentIntentId: `pi_mock_recovery_${chargeId}`, feeCents: estimateStripeFeeCents(charge.amountCents), feeIsEstimate: true });
  redirect(`/b/${charge.booking.publicToken}`);
}
