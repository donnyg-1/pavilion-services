import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { computeChargeLedger, computeRefundLedger, type LedgerAmounts } from "@/lib/domain/ledger";
import { bookingTotalCents, referralCreditCents } from "@/lib/domain/pricing";
import { formatCents } from "@/lib/domain/money";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { textResident } from "@/lib/sms/send";
import * as S from "@/lib/sms/templates";
import { payments } from "@/lib/payments";
import { bookingContext, bookingInclude, dealContext, dealInclude, lockDealIfDue, referralStatus } from "./deals";

type Result = { ok: true; message: string } | { ok: false; message: string };

async function loadBooking(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { ...bookingInclude, charges: { orderBy: { createdAt: "desc" } } } });
  if (!booking) return null;
  const deal = await db.deal.findUniqueOrThrow({ where: { id: booking.dealId }, include: dealInclude });
  return { booking, deal };
}

/** Admin: mark the job done and charge the saved card off-session at the locked price. */
export async function completeAndCharge(bookingId: string): Promise<Result> {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return { ok: false, message: "Booking not found." };
  let { deal } = loaded;
  const { booking } = loaded;

  if (await lockDealIfDue(deal.id)) deal = await db.deal.findUniqueOrThrow({ where: { id: deal.id }, include: dealInclude });
  if (deal.lockedPriceCents == null) return { ok: false, message: "Signups are still open, so the final price isn't locked. Close signups first." };
  if (booking.status !== "booked") return { ok: false, message: `This booking is ${booking.status}, not booked.` };
  if (!booking.stripePaymentMethodId || !booking.resident.stripeCustomerId) return { ok: false, message: "No saved card on this booking." };

  // Neighbors who booked with this home's link earn it a credit, split by everyone
  // (it comes off the price the card is charged, and every share is figured on that).
  const jobTotalCents = bookingTotalCents(deal.lockedPriceCents, booking.addOns.map((a) => a.priceCents));
  const { referrals } = await referralStatus(deal, booking.id);
  const creditCents = referralCreditCents({ referrals, perReferralCents: deal.referralCreditCents, capCents: deal.referralCreditCapCents, jobTotalCents });
  const amountCents = jobTotalCents - creditCents;

  // Claim the booking so a double-click can't charge twice.
  const claimed = await db.booking.updateMany({ where: { id: booking.id, status: "booked" }, data: { status: "completed", completedAt: new Date() } });
  if (claimed.count === 0) return { ok: false, message: "This booking is already being charged." };
  const charge = await db.charge.create({ data: { bookingId: booking.id, amountCents, referralCreditCents: creditCents } });

  return attemptCharge(charge.id);
}

/** Admin: try the saved card again after a failure. */
export async function retryCharge(bookingId: string): Promise<Result> {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return { ok: false, message: "Booking not found." };
  const { booking } = loaded;
  if (booking.status !== "failed") return { ok: false, message: "Only failed charges can be retried." };
  const last = booking.charges[0];
  const claimed = await db.booking.updateMany({ where: { id: booking.id, status: "failed" }, data: { status: "completed" } });
  if (claimed.count === 0) return { ok: false, message: "This booking is already being charged." };
  const charge = await db.charge.create({ data: { bookingId: booking.id, amountCents: last.amountCents, referralCreditCents: last.referralCreditCents } });
  return attemptCharge(charge.id);
}

async function attemptCharge(chargeId: string): Promise<Result> {
  const charge = await db.charge.findUniqueOrThrow({ where: { id: chargeId } });
  const { booking, deal } = (await loadBooking(charge.bookingId))!;
  const res = await payments().chargeOffSession({
    chargeId: charge.id,
    bookingId: booking.id,
    customerId: booking.resident.stripeCustomerId!,
    paymentMethodId: booking.stripePaymentMethodId!,
    amountCents: charge.amountCents,
    description: `${deal.title} · ${deal.community.name} · ${booking.communityAddress.raw}`,
    receiptEmail: booking.resident.email,
  });

  if (res.status === "succeeded") {
    await recordChargeSuccess(charge.id, res);
    return { ok: true, message: `Charged ${formatCents(charge.amountCents)}.` };
  }

  await db.$transaction([
    db.charge.update({ where: { id: charge.id }, data: { status: "failed", failureCode: res.code, failureMessage: res.message, stripePaymentIntentId: res.paymentIntentId } }),
    db.booking.update({ where: { id: booking.id }, data: { status: "failed" } }),
  ]);
  const payUrl = url(`/b/${booking.publicToken}/pay`);
  await db.charge.update({ where: { id: charge.id }, data: { recoveryUrl: payUrl } });
  await sendEmail({
    to: booking.resident.email,
    template: "payment_failed",
    dealId: deal.id,
    bookingId: booking.id,
    ...T.paymentFailed(dealContext(deal), bookingContext(deal, booking), charge.amountCents, payUrl, res.code === "authentication_required" || res.code === "requires_action"),
  });
  await textResident({ resident: booking.resident, template: "payment_failed", dealId: deal.id, bookingId: booking.id, dedupeKey: `payment_failed:${charge.id}`, body: S.paymentFailed(dealContext(deal), charge.amountCents, payUrl) });
  return { ok: false, message: `Charge failed (${res.code}). We emailed the resident a payment link.` };
}

/**
 * Records a successful payment and writes the ledger row. Idempotent: called from the
 * off-session charge, the recovery checkout redirect and the Stripe webhook.
 */
export async function recordChargeSuccess(chargeId: string, p: { paymentIntentId: string; feeCents: number; feeIsEstimate: boolean }) {
  const done = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Charge" WHERE id = ${chargeId} FOR UPDATE`;
    const charge = await tx.charge.findUniqueOrThrow({ where: { id: chargeId }, include: { booking: { include: { deal: true } } } });
    if (charge.status === "succeeded") return false;
    const deal = charge.booking.deal;
    const rates = { commissionBps: deal.commissionBps, managerShareBps: deal.managerShareBps, hoaShareBps: deal.hoaShareBps, shareBasis: deal.shareBasis };
    const amounts = computeChargeLedger(charge.amountCents, p.feeCents, rates);

    await tx.charge.update({ where: { id: chargeId }, data: { status: "succeeded", stripePaymentIntentId: p.paymentIntentId, failureCode: null, failureMessage: null } });
    await tx.booking.update({ where: { id: charge.bookingId }, data: { status: "charged", completedAt: charge.booking.completedAt ?? new Date() } });
    await tx.ledgerEntry.create({
      data: { dealId: deal.id, bookingId: charge.bookingId, chargeId, type: "charge", stripeRefId: p.paymentIntentId, feeIsEstimate: p.feeIsEstimate, referralCreditCents: charge.referralCreditCents, ...amounts, ...rates },
    });
    return true;
  });
  if (!done) return;

  const charge = await db.charge.findUniqueOrThrow({ where: { id: chargeId } });
  const { booking, deal } = (await loadBooking(charge.bookingId))!;
  const addOnTotal = booking.addOns.reduce((s, a) => s + a.priceCents, 0);
  await sendEmail({
    to: booking.resident.email,
    template: "receipt",
    dealId: deal.id,
    bookingId: booking.id,
    dedupeKey: `receipt:${chargeId}`,
    ...T.receipt(dealContext(deal), bookingContext(deal, booking), {
      basePriceCents: charge.amountCents + charge.referralCreditCents - addOnTotal,
      referralCreditCents: charge.referralCreditCents,
      totalCents: charge.amountCents,
      card: booking.cardLast4 ? `${(booking.cardBrand ?? "Card").replace(/^\w/, (c) => c.toUpperCase())} ending ${booking.cardLast4}` : "Card on file",
      ratingUrl: (n) => url(`/r/${booking.publicToken}?score=${n}`),
    }),
  });
}

/** Resident: opens a checkout page to pay a failed charge. */
export async function startRecoveryPayment(token: string): Promise<{ url: string } | { error: string }> {
  const booking = await db.booking.findUnique({ where: { publicToken: token }, include: { ...bookingInclude, charges: { orderBy: { createdAt: "desc" } }, deal: { include: { community: true } } } });
  if (!booking) return { error: "We couldn't find that booking." };
  if (booking.status === "charged") return { error: "This booking is already paid. Thank you!" };
  const charge = booking.charges[0];
  if (booking.status !== "failed" || !charge || charge.status !== "failed") return { error: "There's nothing to pay right now." };

  const session = await payments().createPaymentSession({
    chargeId: charge.id,
    customerId: booking.resident.stripeCustomerId!,
    amountCents: charge.amountCents,
    description: `${booking.deal.title} · ${booking.deal.community.name}`,
    successUrl: url(`/b/${token}?paid_session={CHECKOUT_SESSION_ID}`),
    cancelUrl: url(`/b/${token}`),
  });
  return { url: session.url };
}

export async function syncPaymentSession(sessionId: string) {
  const p = payments();
  if (p.mode !== "stripe") return;
  const s = await p.retrievePaymentSession(sessionId);
  if (s.status === "paid" && s.chargeId) await recordChargeSuccess(s.chargeId, s);
}

/** Admin: full or partial refund. Writes a negative ledger row; Pavilion absorbs Stripe's kept fee. */
export async function refundBooking(bookingId: string, amountCents: number | null): Promise<Result> {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return { ok: false, message: "Booking not found." };
  const { booking, deal } = loaded;
  const charge = booking.charges.find((c) => c.status === "succeeded");
  if (!charge || !charge.stripePaymentIntentId) return { ok: false, message: "There's no successful charge to refund." };

  const remaining = charge.amountCents - charge.refundedCents;
  const amount = amountCents ?? remaining;
  if (amount <= 0 || amount > remaining) return { ok: false, message: `You can refund up to ${formatCents(remaining)}.` };

  const original = await db.ledgerEntry.findFirst({ where: { chargeId: charge.id, type: "charge" } });
  if (!original) return { ok: false, message: "Missing ledger entry for this charge." };

  let refundId: string;
  try {
    ({ refundId } = await payments().refund({ paymentIntentId: charge.stripePaymentIntentId, amountCents: amount, idempotencyKey: `refund-${charge.id}-${charge.refundedCents}-${amount}` }));
  } catch (err) {
    return { ok: false, message: `Stripe refused the refund: ${(err as Error).message}` };
  }

  const refundAmounts = computeRefundLedger(original as LedgerAmounts, amount, charge.refundedCents);
  const full = amount === remaining;
  await db.$transaction([
    db.charge.update({ where: { id: charge.id }, data: { refundedCents: { increment: amount } } }),
    db.ledgerEntry.create({
      data: {
        dealId: deal.id, bookingId: booking.id, chargeId: charge.id, type: "refund", stripeRefId: refundId,
        commissionBps: original.commissionBps, managerShareBps: original.managerShareBps, hoaShareBps: original.hoaShareBps, shareBasis: original.shareBasis,
        ...refundAmounts,
      },
    }),
    ...(full ? [db.booking.update({ where: { id: booking.id }, data: { status: "refunded" } })] : []),
  ]);

  await sendEmail({ to: booking.resident.email, template: "refund_issued", dealId: deal.id, bookingId: booking.id, ...T.refundIssued(dealContext(deal), bookingContext(deal, booking), amount, full) });
  return { ok: true, message: `Refunded ${formatCents(amount)}.` };
}
