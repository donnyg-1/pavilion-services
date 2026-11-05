import { z } from "zod";
import type { BookingSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { config, url } from "@/lib/config";
import { decideBooking, holdsSpot, residentCanCancel, shouldNotifyWaitlist, signupWindow } from "@/lib/domain/capacity";
import { normalizeAddress } from "@/lib/domain/address";
import { currentPriceCents, tierUnlockedBetween } from "@/lib/domain/pricing";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { textResident } from "@/lib/sms/send";
import * as S from "@/lib/sms/templates";
import { payments, type SavedCard } from "@/lib/payments";
import { MOCK_CARDS } from "@/lib/payments/mock";
import { publicToken, referralCode } from "@/lib/tokens";
import { bookingContext, bookingInclude, countBookings, dealContext, dealInclude, lockDealIfDue, referralStatus, viewDeal, type DealFull } from "./deals";

export const SOURCES = ["manager", "board", "facebook", "flyer"] as const;

export function parseSource(src: string | null | undefined, ref: string | null | undefined): BookingSource {
  if (ref) return "referral";
  return (SOURCES as readonly string[]).includes(src ?? "") ? (src as BookingSource) : "direct";
}

const phoneDigits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

export const bookingSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .refine((s) => phoneDigits(s).length === 10, "Enter a 10-digit phone number")
    .transform((s) => {
      const d = phoneDigits(s);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }),
  street: z.string().trim().min(3, "Enter your street address").max(200),
  unit: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  addOnIds: z.array(z.string()).default([]),
  smsOptIn: z.boolean().default(false),
});

export const contactSchema = bookingSchema.pick({ name: true, email: true, phone: true, street: true, unit: true });

export type BookingResult =
  | { kind: "ready"; token: string; clientSecret: string }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "not_on_list" }
  | { kind: "already_booked" }
  | { kind: "full" }
  | { kind: "closed" }
  | { kind: "error"; message: string };

export function authorizationText(deal: { vendor: { name: string } }) {
  return `By booking, you agree to the booking terms and authorize Pavilion to charge your card the final group price (plus any add-ons) after ${deal.vendor.name} completes the job. You won't be charged today.`;
}

/** Consent fields for service-day texts. Residents are asked on their booking page, right after booking. */
function smsConsent(optIn: boolean) {
  return optIn ? { smsOptIn: true, smsConsentAt: new Date(), smsOptedOutAt: null } : { smsOptIn: false };
}

/** Finds the community address for typed input. Falls back to the street without a unit for single-family lists. */
export async function findAddress(communityId: string, street: string, unit: string) {
  const n = normalizeAddress(street, unit);
  if (!n) return { normalized: null, address: null };
  let address = await db.communityAddress.findFirst({ where: { communityId, normalized: n.key, active: true } });
  if (!address && n.unit) {
    address = await db.communityAddress.findFirst({ where: { communityId, normalized: n.street, active: true } });
  }
  return { normalized: n, address };
}

/**
 * Turns service-day texts on or off from the booking page (where residents are asked
 * after booking). Turning them on sends the confirmation text, which says how to opt out.
 */
export async function setBookingTexts(token: string, on: boolean): Promise<{ ok: boolean; message: string }> {
  const booking = await db.booking.findUnique({ where: { publicToken: token }, include: bookingInclude });
  if (!booking) return { ok: false, message: "Booking not found." };
  const resident = await db.resident.update({
    where: { id: booking.residentId },
    data: on ? smsConsent(true) : { smsOptIn: false, smsOptedOutAt: new Date() },
  });
  if (on && booking.status === "booked") {
    const deal = (await db.deal.findUnique({ where: { id: booking.dealId }, include: dealInclude }))!;
    await textResident({ resident, template: "booking_confirmed", dealId: deal.id, bookingId: booking.id, dedupeKey: `confirmed:${booking.id}`, body: S.bookingConfirmed(dealContext(deal), bookingContext(deal, booking)) });
  }
  return { ok: true, message: on ? "Texts are on." : "Texts are off. We'll still email you." };
}

/**
 * Step 1 of booking: validates eligibility and capacity, holds a spot, and returns a
 * SetupIntent for the browser to save the card with. Step 2 is finalizeBooking.
 */
export async function prepareBooking(slug: string, raw: unknown, attribution: { src?: string | null; ref?: string | null }): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { kind: "invalid", fieldErrors };
  }
  const input = parsed.data;

  let deal = await db.deal.findUnique({ where: { slug }, include: dealInclude });
  if (!deal) return { kind: "error", message: "This deal doesn't exist." };
  if (await lockDealIfDue(deal.id)) deal = (await db.deal.findUnique({ where: { slug }, include: dealInclude }))!;

  const { normalized, address } = await findAddress(deal.communityId, input.street, input.unit);
  if (!normalized) return { kind: "invalid", fieldErrors: { street: "Include your house number, like 1234 N 500 E" } };

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + (config.holdMinutes + 1) * 60_000);

  let referredById: string | null = null;
  if (attribution.ref) {
    const referrer = await db.booking.findFirst({ where: { dealId: deal.id, referralCode: attribution.ref.toUpperCase() } });
    referredById = referrer?.id ?? null;
  }
  const source = referredById ? "referral" : parseSource(attribution.src, null);

  const outcome = await db.$transaction(async (tx) => {
    // Serialize bookings per deal so two people can't take the last spot.
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${deal.id} FOR UPDATE`;

    const existing = address
      ? await tx.booking.findMany({ where: { dealId: deal.id, communityAddressId: address.id, status: { in: ["pending_setup", "booked", "completed", "charged", "failed"] } } })
      : [];
    // Someone who backed out of the card page and tried again shouldn't be blocked by their own hold.
    const ownHold = existing.find((b) => b.status === "pending_setup");
    if (ownHold) await tx.booking.update({ where: { id: ownHold.id }, data: { status: "expired" } });
    const alreadyBooked = existing.some((b) => b.id !== ownHold?.id && holdsSpot(b, now));

    const counts = await countBookings(tx, deal.id, now);
    const decision = decideBooking({
      window: signupWindow(deal, now),
      addressOnList: !!address,
      addressAlreadyBooked: alreadyBooked,
      capacity: deal.capacity,
      spotsTaken: counts.spotsTaken,
    });
    if (!decision.ok) return { ok: false as const, reason: decision.reason };

    const resident = await tx.resident.upsert({
      where: { email: input.email },
      create: { email: input.email, name: input.name, phone: input.phone, communityAddressId: address!.id, ...smsConsent(input.smsOptIn) },
      // A returning resident keeps the text setting they chose last time.
      update: { name: input.name, phone: input.phone, communityAddressId: address!.id, ...(input.smsOptIn ? smsConsent(true) : {}) },
    });

    const addOns = deal.addOns.filter((a) => input.addOnIds.includes(a.id));
    const booking = await tx.booking.create({
      data: {
        dealId: deal.id,
        residentId: resident.id,
        communityAddressId: address!.id,
        unit: normalized.unit,
        notes: input.notes,
        status: "pending_setup",
        source,
        referredById,
        referralCode: referralCode(),
        publicToken: publicToken(),
        holdExpiresAt,
        addOns: { create: addOns.map((a) => ({ addOnId: a.id, priceCents: a.priceCents })) },
      },
    });
    return { ok: true as const, booking, resident };
  });

  if (!outcome.ok) {
    const reason = outcome.reason;
    if (reason === "already_booked" && address) await resendConfirmation(deal, address.id);
    if (reason === "draft" || reason === "closed") return { kind: "closed" };
    return { kind: reason };
  }

  const { booking, resident } = outcome;
  try {
    const p = payments();
    const customerId = await p.ensureCustomer(resident);
    if (customerId !== resident.stripeCustomerId) {
      await db.resident.update({ where: { id: resident.id }, data: { stripeCustomerId: customerId } });
    }
    const intent = await p.createSetupIntent({ bookingId: booking.id, customerId, description: `${deal.title} · ${deal.community.name}` });
    return { kind: "ready", token: booking.publicToken, clientSecret: intent.clientSecret };
  } catch (err) {
    console.error("[booking] could not start card setup", err);
    await db.booking.update({ where: { id: booking.id }, data: { status: "expired" } });
    return { kind: "error", message: "We couldn't connect to our card processor. Please try again." };
  }
}

/** Someone tried to book an address that's already booked: re-send the existing confirmation to the email on file. */
async function resendConfirmation(deal: DealFull, communityAddressId: string) {
  const b = await db.booking.findFirst({
    where: { dealId: deal.id, communityAddressId, status: { in: ["booked", "completed", "charged", "failed"] } },
    include: bookingInclude,
  });
  if (!b) return;
  const counts = await countBookings(db, deal.id);
  const v = viewDeal(deal, counts);
  await sendEmail({
    to: b.resident.email,
    template: "booking_confirmed_resend",
    dealId: deal.id,
    bookingId: b.id,
    dedupeKey: `resend:${b.id}:${new Date().toISOString().slice(0, 13)}`, // at most hourly
    ...T.bookingConfirmed(dealContext(deal), bookingContext(deal, b), v.priceCents, v.next),
  });
}

/**
 * Confirms a booking once the card is saved. Idempotent: the Stripe webhook and the
 * success redirect may both call it.
 */
export async function confirmBooking(bookingId: string, card: SavedCard): Promise<"booked" | "already" | "waitlisted" | "missing"> {
  const result = await db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!b) return { status: "missing" as const };
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${b.dealId} FOR UPDATE`;
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== "pending_setup" && booking.status !== "expired") return { status: "already" as const };

    const deal = await tx.deal.findUniqueOrThrow({ where: { id: booking.dealId }, include: { tiers: true } });
    const now = new Date();

    // The hold lapsed (slow checkout). Re-check capacity before confirming.
    if (booking.status === "expired" || (booking.holdExpiresAt && booking.holdExpiresAt < now)) {
      const counts = await countBookings(tx, deal.id, now);
      const open = signupWindow(deal, now) === "open";
      if (!open || counts.spotsTaken >= deal.capacity) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "expired", stripePaymentMethodId: card.paymentMethodId } });
        return { status: "waitlisted" as const, booking, deal };
      }
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "booked",
        bookedAt: now,
        holdExpiresAt: null,
        stripePaymentMethodId: card.paymentMethodId,
        cardBrand: card.brand,
        cardLast4: card.last4,
      },
    });
    const counts = await countBookings(tx, deal.id, now);
    const newPeak = Math.max(deal.peakBookedCount, counts.confirmed);
    if (newPeak !== deal.peakBookedCount) await tx.deal.update({ where: { id: deal.id }, data: { peakBookedCount: newPeak } });
    const unlocked = deal.lockedPriceCents == null ? tierUnlockedBetween(deal.tiers, deal.peakBookedCount, newPeak) : null;
    return { status: "booked" as const, unlocked, newPeak };
  });

  if (result.status === "missing" || result.status === "already") return result.status;

  const deal = (await db.deal.findUnique({ where: { id: (await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).dealId }, include: dealInclude }))!;
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
  const ctx = dealContext(deal);

  if (result.status === "waitlisted") {
    await db.waitlistEntry.upsert({
      where: { dealId_email: { dealId: deal.id, email: booking.resident.email } },
      create: { dealId: deal.id, name: booking.resident.name, email: booking.resident.email, phone: booking.resident.phone, address: booking.communityAddress.raw, source: booking.source },
      update: {},
    });
    await sendEmail({ to: booking.resident.email, template: "waitlist_joined", dealId: deal.id, bookingId, ...T.waitlistJoined(ctx, booking.resident.name) });
    return "waitlisted";
  }

  const counts = await countBookings(db, deal.id);
  const v = viewDeal(deal, counts);
  await sendEmail({
    to: booking.resident.email,
    template: "booking_confirmed",
    dealId: deal.id,
    bookingId,
    dedupeKey: `confirmed:${bookingId}`,
    ...T.bookingConfirmed(ctx, bookingContext(deal, booking), v.priceCents, v.next),
  });
  await textResident({ resident: booking.resident, template: "booking_confirmed", dealId: deal.id, bookingId, dedupeKey: `confirmed:${bookingId}`, body: S.bookingConfirmed(ctx, bookingContext(deal, booking)) });

  await notifyReferrer(deal, booking);

  if (result.unlocked) {
    const others = await db.booking.findMany({ where: { dealId: deal.id, status: "booked", id: { not: bookingId } }, include: bookingInclude });
    for (const o of others) {
      await sendEmail({
        to: o.resident.email,
        template: "tier_unlocked",
        dealId: deal.id,
        bookingId: o.id,
        dedupeKey: `tier:${deal.id}:${result.unlocked.minHomes}:${o.id}`,
        ...T.tierUnlocked(ctx, bookingContext(deal, o), counts.confirmed, result.unlocked.priceCents, v.next),
      });
    }
  }
  return "booked";
}

/** Tells the neighbor whose link was used that they earned credit (until they hit the cap). */
async function notifyReferrer(deal: DealFull, booking: { id: string; referredById: string | null }) {
  if (!booking.referredById || deal.referralCreditCents <= 0) return;
  const referrer = await db.booking.findUnique({ where: { id: booking.referredById }, include: bookingInclude });
  if (!referrer || referrer.status !== "booked") return;
  const status = await referralStatus(deal, referrer.id);
  // Already at the cap before this neighbor booked: nothing new earned, so no email.
  if ((status.referrals - 1) * deal.referralCreditCents >= deal.referralCreditCapCents) return;
  await sendEmail({
    to: referrer.resident.email,
    template: "referral_earned",
    dealId: deal.id,
    bookingId: referrer.id,
    dedupeKey: `referral:${booking.id}`,
    ...T.referralEarned(dealContext(deal), bookingContext(deal, referrer), status),
  });
}

/**
 * Step 2 of booking, called by the browser once the card is saved. `ref` is the
 * SetupIntent id, or in mock mode the chosen test card. Stripe's webhook runs the
 * same confirmation, so whichever arrives first wins.
 */
export async function finalizeBooking(token: string, ref: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking) return { ok: false, message: "We couldn't find that booking." };
  const p = payments();

  if (p.mode === "mock") {
    const card = MOCK_CARDS[ref as keyof typeof MOCK_CARDS];
    if (!card) return { ok: false, message: "Pick a test card." };
    await confirmBooking(booking.id, { paymentMethodId: ref, brand: card.brand, last4: card.last4 });
    return { ok: true };
  }

  const si = await p.retrieveSetupIntent(ref);
  if (si.bookingId !== booking.id) return { ok: false, message: "That card doesn't belong to this booking." };
  if (si.status !== "succeeded") return { ok: false, message: "Your card wasn't saved. Please try again." };
  await confirmBooking(booking.id, si.card);
  return { ok: true };
}

/** Used by the webhook and by the 3D Secure return redirect. */
export async function syncSetupIntent(setupIntentId: string) {
  const p = payments();
  if (p.mode !== "stripe") return;
  const si = await p.retrieveSetupIntent(setupIntentId);
  if (si.status === "succeeded" && si.bookingId) await confirmBooking(si.bookingId, si.card);
}

export async function cancelBooking(bookingId: string, by: "resident" | "admin"): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!b) return { ok: false as const, message: "Booking not found." };
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${b.dealId} FOR UPDATE`;
    const deal = await tx.deal.findUniqueOrThrow({ where: { id: b.dealId } });

    if (by === "resident" && !residentCanCancel(b.status, deal.signupDeadline, now)) {
      return { ok: false as const, message: "Signups have closed, so this booking can't be cancelled online. Reply to your confirmation email and we'll help." };
    }
    if (by === "admin" && !["booked", "pending_setup", "failed", "completed"].includes(b.status)) {
      return { ok: false as const, message: `Can't cancel a booking that is ${b.status}. Refund it instead.` };
    }
    const before = await countBookings(tx, deal.id, now);
    await tx.booking.update({ where: { id: b.id }, data: { status: "cancelled", cancelledAt: now, holdExpiresAt: null } });
    const after = await countBookings(tx, deal.id, now);
    const notify = shouldNotifyWaitlist({ window: signupWindow(deal, now), capacity: deal.capacity, spotsTakenBefore: before.spotsTaken, spotsTakenAfter: after.spotsTaken });
    return { ok: true as const, notify, wasBooked: b.status === "booked" };
  });

  if (!result.ok) return result;

  const deal = (await db.deal.findFirst({ where: { bookings: { some: { id: bookingId } } }, include: dealInclude }))!;
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
  const ctx = dealContext(deal);
  if (result.wasBooked) {
    await sendEmail({ to: booking.resident.email, template: "booking_cancelled", dealId: deal.id, bookingId, ...T.bookingCancelled(ctx, bookingContext(deal, booking)) });
  }
  if (result.notify) await notifyWaitlist(deal);
  return { ok: true };
}

/** Emails everyone on the waitlist: first to book gets the spot. */
export async function notifyWaitlist(deal: DealFull) {
  const entries = await db.waitlistEntry.findMany({ where: { dealId: deal.id } });
  const ctx = dealContext(deal);
  const price = currentPriceCents(deal);
  const now = new Date();
  for (const e of entries) {
    await sendEmail({ to: e.email, template: "spot_opened", dealId: deal.id, ...T.spotOpened(ctx, e.name, price) });
  }
  await db.waitlistEntry.updateMany({ where: { dealId: deal.id }, data: { notifiedAt: now } });
}

export async function joinWaitlist(slug: string, raw: unknown, src: string | null, ref: string | null) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0].message };
  const deal = await db.deal.findUnique({ where: { slug }, include: dealInclude });
  if (!deal) return { ok: false as const, message: "This deal doesn't exist." };
  const { name, email, phone, street, unit } = parsed.data;
  await db.waitlistEntry.upsert({
    where: { dealId_email: { dealId: deal.id, email } },
    create: { dealId: deal.id, name, email, phone, address: [street, unit].filter(Boolean).join(" #"), source: parseSource(src, ref) },
    update: { name, phone, address: [street, unit].filter(Boolean).join(" #") },
  });
  await sendEmail({ to: email, template: "waitlist_joined", dealId: deal.id, ...T.waitlistJoined(dealContext(deal), name) });
  return { ok: true as const };
}

export async function requestAddressReview(slug: string, raw: unknown) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0].message };
  const deal = await db.deal.findUnique({ where: { slug }, include: dealInclude });
  if (!deal) return { ok: false as const, message: "This deal doesn't exist." };
  const { name, email, phone, street, unit } = parsed.data;
  const rawAddress = [street, unit].filter(Boolean).join(" #");
  const existing = await db.addressReview.findFirst({ where: { dealId: deal.id, email, status: "open" } });
  if (!existing) await db.addressReview.create({ data: { dealId: deal.id, name, email, phone, rawAddress } });

  const ctx = dealContext(deal);
  await sendEmail({ to: email, template: "review_received", dealId: deal.id, ...T.reviewReceived(ctx, name, rawAddress) });
  const admin = config.adminEmail();
  if (admin) {
    await sendEmail({ to: admin, template: "admin_review_alert", dealId: deal.id, ...T.adminReviewAlert(ctx, { name, email, phone, address: rawAddress }, url(`/admin/deals/${deal.id}?tab=reviews`)) });
  }
  return { ok: true as const };
}
