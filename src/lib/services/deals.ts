import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { url } from "@/lib/config";
import { holdsSpot, signupWindow, spotsLeft, type SignupWindow } from "@/lib/domain/capacity";
import { currentPriceCents, nextTier, referralsUntilCap, tierForCount } from "@/lib/domain/pricing";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { routeSortKey } from "@/lib/domain/address";
import { toCsv } from "@/lib/domain/csv";

export const dealInclude = {
  community: true,
  vendor: true,
  tiers: { orderBy: { minHomes: "asc" } },
  addOns: { where: { active: true }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.DealInclude;

export type DealFull = Prisma.DealGetPayload<{ include: typeof dealInclude }>;

export const bookingInclude = {
  resident: true,
  communityAddress: true,
  addOns: { include: { addOn: true } },
} satisfies Prisma.BookingInclude;

export type BookingFull = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

const CONFIRMED = ["booked", "completed", "charged", "failed", "refunded"] as const;

export async function countBookings(client: Tx | typeof db, dealId: string, now = new Date()) {
  const rows = await client.booking.findMany({
    where: { dealId, status: { in: ["pending_setup", ...CONFIRMED] } },
    select: { status: true, holdExpiresAt: true },
  });
  return {
    confirmed: rows.filter((r) => (CONFIRMED as readonly string[]).includes(r.status)).length,
    spotsTaken: rows.filter((r) => holdsSpot(r, now)).length,
  };
}

export function fillCopy(template: string, deal: { community: { name: string }; vendor: { name: string } }): string {
  return template.replaceAll("{community}", deal.community.name).replaceAll("{vendor}", deal.vendor.name);
}

export type DealView = {
  window: SignupWindow;
  confirmed: number;
  spotsTaken: number;
  spotsLeft: number;
  isFull: boolean;
  priceCents: number;
  savingsCents: number;
  locked: boolean;
  currentTierMinHomes: number;
  next: { homesNeeded: number; priceCents: number; minHomes: number } | null;
};

export function viewDeal(deal: DealFull, counts: { confirmed: number; spotsTaken: number }, now = new Date()): DealView {
  const priceCents = currentPriceCents(deal);
  const locked = deal.lockedPriceCents != null;
  const nt = locked ? null : nextTier(deal.tiers, deal.peakBookedCount);
  const left = spotsLeft(deal.capacity, counts.spotsTaken);
  return {
    window: signupWindow(deal, now),
    confirmed: counts.confirmed,
    spotsTaken: counts.spotsTaken,
    spotsLeft: left,
    isFull: left === 0,
    priceCents,
    savingsCents: Math.max(0, deal.normalPriceCents - priceCents),
    locked,
    currentTierMinHomes: tierForCount(deal.tiers, deal.peakBookedCount).minHomes,
    // Tiers unlock off the peak, but the homes still needed are counted from today's bookings.
    next: nt ? { minHomes: nt.tier.minHomes, priceCents: nt.tier.priceCents, homesNeeded: Math.max(1, nt.tier.minHomes - counts.confirmed) } : null,
  };
}

export function dealContext(deal: DealFull): T.DealContext {
  return {
    title: deal.title,
    serviceName: deal.serviceName,
    vendorName: deal.vendor.name,
    communityName: deal.community.name,
    serviceDate: deal.serviceDate,
    backupDate: deal.backupDate,
    arrivalWindow: deal.arrivalWindow,
    signupDeadline: deal.signupDeadline,
    normalPriceCents: deal.normalPriceCents,
    reserveFundLine: fillCopy(deal.reserveFundLine, deal),
    guaranteeLine: fillCopy(deal.guaranteeLine, deal),
    dealUrl: url(`/d/${deal.slug}`),
    referralCreditCents: deal.referralCreditCents,
    referralCreditCapCents: deal.referralCreditCapCents,
  };
}

/** Bookings that count as a successful referral: the neighbor booked and didn't cancel. */
export const REFERRAL_STATUSES = ["booked", "completed", "charged", "failed", "refunded"] as const;

export type ReferralStatus = { enabled: boolean; referrals: number; earnedCents: number; perCents: number; capCents: number; left: number };

/** How much a home has earned from neighbors booking with its link (before the per-job limit). */
export async function referralStatus(deal: { referralCreditCents: number; referralCreditCapCents: number }, bookingId: string): Promise<ReferralStatus> {
  const per = deal.referralCreditCents;
  const cap = deal.referralCreditCapCents;
  const referrals = await db.booking.count({ where: { referredById: bookingId, status: { in: [...REFERRAL_STATUSES] } } });
  return { enabled: per > 0, referrals, earnedCents: Math.min(referrals * per, cap), perCents: per, capCents: cap, left: referralsUntilCap(referrals, per, cap) };
}

export function bookingAddress(b: { unit: string | null; communityAddress: { raw: string; normalized: string } }): string {
  if (b.unit && !b.communityAddress.normalized.includes("#")) return `${b.communityAddress.raw} #${b.unit}`;
  return b.communityAddress.raw;
}

export function bookingContext(deal: { slug: string }, b: BookingFull): T.BookingContext {
  return {
    name: b.resident.name,
    address: bookingAddress(b),
    manageUrl: url(`/b/${b.publicToken}`),
    shareUrl: url(`/d/${deal.slug}?ref=${b.referralCode}`),
    addOns: b.addOns.map((a) => ({ name: a.addOn.name, priceCents: a.priceCents })),
  };
}

export async function loadDealBySlug(slug: string) {
  return db.deal.findUnique({ where: { slug }, include: dealInclude });
}

/**
 * Locks the tier once the signup deadline passes. Safe to call on every page load:
 * only the first caller wins the update, expires stale holds and emails final prices.
 */
export async function lockDealIfDue(dealId: string, now = new Date()): Promise<boolean> {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: dealInclude });
  if (!deal || deal.lockedAt || deal.status !== "open" || deal.signupDeadline > now) return false;

  const price = tierForCount(deal.tiers, deal.peakBookedCount).priceCents;
  const res = await db.deal.updateMany({ where: { id: dealId, lockedAt: null }, data: { lockedAt: now, lockedPriceCents: price } });
  if (res.count === 0) return false;

  await db.booking.updateMany({ where: { dealId, status: "pending_setup" }, data: { status: "expired" } });

  const bookings = await db.booking.findMany({ where: { dealId, status: "booked" }, include: bookingInclude });
  const ctx = dealContext(deal);
  for (const b of bookings) {
    const referral = await referralStatus(deal, b.id);
    await sendEmail({
      to: b.resident.email,
      template: "signups_closed",
      dealId,
      bookingId: b.id,
      dedupeKey: `locked:${b.id}`,
      ...T.signupsClosed(ctx, bookingContext(deal, b), price, referral),
    });
  }
  await emailRouteToVendor(dealId, "signups_closed");
  return true;
}

// ─── Vendor route list ──────────────────────────────────────────────────────

/** Booked homes in driving order (street, then house number), for the crew. */
export async function routeStops(dealId: string): Promise<T.RouteStop[]> {
  const bookings = await db.booking.findMany({ where: { dealId, status: { in: ["booked", "completed", "charged", "failed"] } }, include: bookingInclude });
  bookings.sort((a, b) => {
    const [sa, na] = routeSortKey(a.communityAddress.normalized);
    const [sb, nb] = routeSortKey(b.communityAddress.normalized);
    return sa === sb ? na - nb : sa.localeCompare(sb);
  });
  return bookings.map((b, i) => ({ stop: i + 1, address: bookingAddress(b), name: b.resident.name, phone: b.resident.phone, addOns: b.addOns.map((a) => a.addOn.name), notes: b.notes }));
}

export function routeCsv(stops: T.RouteStop[]): string {
  return toCsv([["Stop", "Address", "Name", "Phone", "Add-ons", "Notes for crew"], ...stops.map((s) => [s.stop, s.address, s.name, s.phone, s.addOns.join("; "), s.notes])]);
}

/**
 * Emails the vendor the route list (with a CSV attached). Sent automatically when signups
 * close, and again whenever staff press "Email route list" (e.g. after a cancellation).
 */
export async function emailRouteToVendor(dealId: string, reason: "signups_closed" | "updated") {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
  if (!deal.vendor.email) return { ok: false as const, message: `${deal.vendor.name} has no email on file. Add one under Vendors.` };
  const stops = await routeStops(dealId);
  await sendEmail({
    to: deal.vendor.email,
    template: "vendor_route",
    dealId,
    dedupeKey: reason === "signups_closed" ? `route:${dealId}:${deal.lockedAt?.toISOString()}` : undefined,
    attachments: [{ filename: `${deal.slug}-route.csv`, content: routeCsv(stops) }],
    ...T.vendorRoute(dealContext(deal), stops, { contactName: deal.vendor.contactName, updated: reason === "updated" }),
  });
  return { ok: true as const, message: `Emailed the route list (${stops.length} ${stops.length === 1 ? "home" : "homes"}) to ${deal.vendor.email}.` };
}

/** Marks abandoned card-saving sessions as expired so they stop showing as pending. */
export async function expireStaleHolds(now = new Date()) {
  await db.booking.updateMany({ where: { status: "pending_setup", holdExpiresAt: { lt: now } }, data: { status: "expired" } });
}
