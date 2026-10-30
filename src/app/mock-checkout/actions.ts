"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { recordChargeSuccess } from "@/lib/services/charging";
import { estimateStripeFeeCents } from "@/lib/domain/ledger";

function assertMock() {
  if (config.paymentsMode() !== "mock") throw new Error("Mock checkout is disabled when Stripe is configured");
}

export async function mockPay(chargeId: string) {
  assertMock();
  const charge = await db.charge.findUniqueOrThrow({ where: { id: chargeId }, include: { booking: true } });
  await recordChargeSuccess(chargeId, { paymentIntentId: `pi_mock_recovery_${chargeId}`, feeCents: estimateStripeFeeCents(charge.amountCents), feeIsEstimate: true });
  redirect(`/b/${charge.booking.publicToken}`);
}
