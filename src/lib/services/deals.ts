import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { url } from "@/lib/config";
import { holdsSpot, signupWindow, spotsLeft, type SignupWindow } from "@/lib/domain/capacity";
import { currentPriceCents, nextTier, tierForCount } from "@/lib/domain/pricing";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";

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
  };
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
    await sendEmail({
      to: b.resident.email,
      template: "signups_closed",
      dealId,
      bookingId: b.id,
      dedupeKey: `locked:${b.id}`,
      ...T.signupsClosed(ctx, bookingContext(deal, b), price),
    });
  }
  return true;
}

/** Marks abandoned card-saving sessions as expired so they stop showing as pending. */
export async function expireStaleHolds(now = new Date()) {
  await db.booking.updateMany({ where: { status: "pending_setup", holdExpiresAt: { lt: now } }, data: { status: "expired" } });
}
