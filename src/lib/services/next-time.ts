// "Save my spot for next time": after the job, a resident can ask to hear first when the
// same service comes back to their community. It records interest only. Nothing is booked
// or charged. When the next service day opens, staff email those homes a link that opens
// the new deal with their details already filled in.

import type { BookingStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { countBookings, dealContext, dealInclude, viewDeal } from "./deals";

/** A home can save its spot once its job is done. */
export const CAN_SAVE_SPOT: BookingStatus[] = ["completed", "charged"];
/** Statuses that mean a resident already has (or had) a spot on a deal, so we don't invite them to it. */
const HAS_SPOT: BookingStatus[] = ["pending_setup", "booked", "completed", "charged", "failed"];

export async function setNextTime(token: string, on: boolean): Promise<{ ok: boolean; message: string }> {
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking) return { ok: false, message: "Booking not found." };
  if (!CAN_SAVE_SPOT.includes(booking.status)) return { ok: false, message: "You can save your spot once the job is done." };
  await db.booking.update({ where: { id: booking.id }, data: { nextTimeAt: on ? new Date() : null } });
  return { ok: true, message: on ? "Your spot is saved." : "Okay, we won't save your spot." };
}

/**
 * Homes to invite to `dealId`: residents whose most recent finished job for the same
 * service in the same community has "save my spot" on, and who haven't booked this deal.
 * Only the latest job counts, so someone who came back and didn't save again isn't invited.
 */
export async function savedSpotsFor(dealId: string) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  const past = await db.booking.findMany({
    where: { dealId: { not: dealId }, status: { in: CAN_SAVE_SPOT }, deal: { communityId: deal.communityId, serviceName: deal.serviceName } },
    include: { resident: true, communityAddress: true, deal: { select: { serviceDate: true } } },
    orderBy: [{ deal: { serviceDate: "desc" } }, { createdAt: "desc" }],
  });
  const latest = new Map<string, (typeof past)[number]>();
  for (const b of past) if (!latest.has(b.residentId)) latest.set(b.residentId, b);

  const here = await db.booking.findMany({ where: { dealId, status: { in: HAS_SPOT } }, select: { residentId: true } });
  const bookedHere = new Set(here.map((b) => b.residentId));
  const saved = [...latest.values()].filter((b) => b.nextTimeAt);
  const invited = await db.messageLog.findMany({ where: { dedupeKey: { in: saved.map((b) => inviteKey(dealId, b.residentId)) } }, select: { dedupeKey: true } });
  const invitedKeys = new Set(invited.map((m) => m.dedupeKey));
  return saved.map((b) => ({ booking: b, booked: bookedHere.has(b.residentId), invited: invitedKeys.has(inviteKey(dealId, b.residentId)) }));
}

const inviteKey = (dealId: string, residentId: string) => `saved_spot:${dealId}:${residentId}`;

/** Emails every saved home that hasn't booked or been invited yet. Safe to press twice. */
export async function inviteSavedSpots(dealId: string): Promise<{ ok: boolean; message: string }> {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
  if (deal.status !== "open") return { ok: false, message: "Open signups first, so the link in the email works." };
  const v = viewDeal(deal, await countBookings(db, deal.id));
  const ctx = dealContext(deal);
  const todo = (await savedSpotsFor(dealId)).filter((s) => !s.booked && !s.invited);
  for (const { booking: b } of todo) {
    const bookUrl = url(`/d/${deal.slug}?src=saved_spot&again=${b.publicToken}`);
    await sendEmail({ to: b.resident.email, template: "saved_spot_open", dealId: deal.id, dedupeKey: inviteKey(dealId, b.residentId), ...T.savedSpotOpen(ctx, b.resident.name, v.priceCents, bookUrl) });
  }
  if (!todo.length) return { ok: true, message: "Everyone who saved a spot has already been emailed or booked." };
  return { ok: true, message: `Emailed ${todo.length} ${todo.length === 1 ? "home" : "homes"} that saved a spot.` };
}

/**
 * Contact details to pre-fill on `slug` from an earlier booking's private link, if that
 * booking is in the same community. The link only goes to the resident who made it.
 */
export async function prefillFrom(token: string | null | undefined, communityId: string) {
  if (!token) return null;
  const b = await db.booking.findUnique({ where: { publicToken: token }, include: { resident: true, communityAddress: true, deal: { select: { communityId: true } } } });
  if (!b || b.deal.communityId !== communityId || !b.communityAddress.active) return null;
  return { name: b.resident.name, email: b.resident.email, phone: b.resident.phone, street: b.communityAddress.raw, unit: b.unit ?? "" };
}
