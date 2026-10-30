import { db } from "@/lib/db";
import { normalizeAddress } from "@/lib/domain/address";
import { parseAddressCsv } from "@/lib/domain/csv";
import { sumLedger, type LedgerAmounts } from "@/lib/domain/ledger";
import { addDays, isoDate, mountainToday } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { bookingContext, bookingInclude, countBookings, dealContext, dealInclude, expireStaleHolds, lockDealIfDue, viewDeal } from "./deals";

// ─── Address list import ────────────────────────────────────────────────────

export type ImportSummary = { added: number; alreadyOnList: number; duplicatesInFile: number; deactivated: number; skipped: { row: number; value: string; reason: string }[] };

export async function importAddresses(communityId: string, csv: string, mode: "append" | "replace"): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, alreadyOnList: 0, duplicatesInFile: 0, deactivated: 0, skipped: [] };
  const seen = new Map<string, string>();
  for (const r of parseAddressCsv(csv)) {
    const n = normalizeAddress(r.street, r.unit);
    if (!n) {
      if (r.street) summary.skipped.push({ row: r.row, value: r.street, reason: "No house number" });
      continue;
    }
    if (seen.has(n.key)) {
      summary.duplicatesInFile++;
      continue;
    }
    seen.set(n.key, [r.street, r.unit && !/#|apt|unit/i.test(r.street) ? `#${r.unit.replace(/^#/, "")}` : ""].filter(Boolean).join(" "));
  }

  const existing = await db.communityAddress.findMany({ where: { communityId } });
  const byKey = new Map(existing.map((a) => [a.normalized, a]));

  await db.$transaction(async (tx) => {
    for (const [key, raw] of seen) {
      const found = byKey.get(key);
      if (found) {
        summary.alreadyOnList++;
        if (!found.active) await tx.communityAddress.update({ where: { id: found.id }, data: { active: true } });
      } else {
        await tx.communityAddress.create({ data: { communityId, normalized: key, raw } });
        summary.added++;
      }
    }
    if (mode === "replace") {
      const drop = existing.filter((a) => a.active && !seen.has(a.normalized)).map((a) => a.id);
      if (drop.length) {
        // Deactivate rather than delete: past bookings still point at these rows.
        await tx.communityAddress.updateMany({ where: { id: { in: drop } }, data: { active: false } });
        summary.deactivated = drop.length;
      }
    }
  });
  return summary;
}

// ─── Address reviews ────────────────────────────────────────────────────────

export async function resolveReview(reviewId: string, approve: boolean, correctedAddress?: string) {
  const review = await db.addressReview.findUniqueOrThrow({ where: { id: reviewId } });
  const deal = await db.deal.findUniqueOrThrow({ where: { id: review.dealId }, include: dealInclude });
  const ctx = dealContext(deal);
  if (approve) {
    const raw = correctedAddress?.trim() || review.rawAddress;
    const n = normalizeAddress(raw);
    if (!n) return { ok: false as const, message: "That address has no house number." };
    await db.communityAddress.upsert({
      where: { communityId_normalized: { communityId: deal.communityId, normalized: n.key } },
      create: { communityId: deal.communityId, normalized: n.key, raw },
      update: { active: true },
    });
    await sendEmail({ to: review.email, template: "review_approved", dealId: deal.id, ...T.reviewApproved(ctx, review.name, raw) });
  } else {
    await sendEmail({ to: review.email, template: "review_rejected", dealId: deal.id, ...T.reviewRejected(ctx, review.name, review.rawAddress) });
  }
  await db.addressReview.update({ where: { id: reviewId }, data: { status: approve ? "approved" : "rejected", resolvedAt: new Date() } });
  return { ok: true as const, message: approve ? "Approved and emailed." : "Rejected and emailed." };
}

// ─── Schedule ───────────────────────────────────────────────────────────────

/** Moves the service day (usually to the weather backup date) and emails every booked home at once. */
export async function rescheduleDeal(dealId: string, newDate: Date, note: string) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
  if (isoDate(newDate) === isoDate(deal.serviceDate)) return { ok: false as const, message: "That's already the service date." };
  const previous = deal.serviceDate;
  const usedBackup = deal.backupDate && isoDate(deal.backupDate) === isoDate(newDate);
  const updated = await db.deal.update({
    where: { id: dealId },
    data: { serviceDate: newDate, backupDate: usedBackup ? null : deal.backupDate, rescheduledAt: new Date() },
    include: dealInclude,
  });
  const bookings = await db.booking.findMany({ where: { dealId, status: { in: ["booked", "failed"] } }, include: bookingInclude });
  const ctx = dealContext(updated);
  for (const b of bookings) {
    await sendEmail({ to: b.resident.email, template: "rescheduled", dealId, bookingId: b.id, ...T.rescheduled(ctx, bookingContext(updated, b), previous, note) });
  }
  return { ok: true as const, message: `Moved to the new date and emailed ${bookings.length} ${bookings.length === 1 ? "home" : "homes"}.` };
}

export async function closeSignupsNow(dealId: string) {
  const now = new Date();
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  if (deal.status !== "open") return { ok: false as const, message: "Only open deals can be closed." };
  if (deal.signupDeadline > now) await db.deal.update({ where: { id: dealId }, data: { signupDeadline: now } });
  await lockDealIfDue(dealId, now);
  return { ok: true as const, message: "Signups closed and the price is locked." };
}

// ─── Daily jobs (Vercel Cron, or the admin "run now" button) ───────────────

export async function runDailyJobs(now = new Date()) {
  await expireStaleHolds(now);

  const due = await db.deal.findMany({ where: { status: "open", lockedAt: null, signupDeadline: { lte: now } }, select: { id: true } });
  for (const d of due) await lockDealIfDue(d.id, now);

  const tomorrow = addDays(mountainToday(now), 1);
  const deals = await db.deal.findMany({ where: { status: "open", serviceDate: new Date(`${tomorrow}T00:00:00Z`) }, include: dealInclude });
  let reminders = 0;
  for (const deal of deals) {
    const ctx = dealContext(deal);
    const bookings = await db.booking.findMany({ where: { dealId: deal.id, status: "booked" }, include: bookingInclude });
    for (const b of bookings) {
      await sendEmail({
        to: b.resident.email,
        template: "reminder",
        dealId: deal.id,
        bookingId: b.id,
        dedupeKey: `reminder:${b.id}:${tomorrow}`,
        ...T.reminder(ctx, bookingContext(deal, b), b.notes),
      });
      reminders++;
    }
  }
  return { locked: due.length, reminders };
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<string, string> = {
  manager: "Management co.",
  board: "HOA board",
  facebook: "Facebook",
  flyer: "Flyer",
  referral: "Neighbor referral",
  direct: "Direct / unknown",
};

export async function dealStats(dealId: string) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: dealInclude });
  const counts = await countBookings(db, dealId);
  const view = viewDeal(deal, counts);
  const [homes, bookings, visits, ledgerRows, ratings, waitlist, openReviews] = await Promise.all([
    db.communityAddress.count({ where: { communityId: deal.communityId, active: true } }),
    db.booking.findMany({ where: { dealId, status: { in: ["booked", "completed", "charged", "failed", "refunded"] } }, select: { source: true } }),
    db.dealVisit.groupBy({ by: ["source"], where: { dealId }, _count: true }),
    db.ledgerEntry.findMany({ where: { dealId } }),
    db.rating.findMany({ where: { booking: { dealId } }, select: { score: true } }),
    db.waitlistEntry.count({ where: { dealId } }),
    db.addressReview.count({ where: { dealId, status: "open" } }),
  ]);

  const sources = Object.keys(SOURCE_LABELS).map((source) => {
    const booked = bookings.filter((b) => b.source === source).length;
    const visitors = visits.find((v) => v.source === source)?._count ?? 0;
    return { source, label: SOURCE_LABELS[source], booked, visitors, conversion: visitors ? booked / visitors : null };
  });
  const totalBooked = bookings.length;
  const totalVisitors = visits.reduce((s, v) => s + v._count, 0);

  return {
    deal,
    view,
    homes,
    percentOfCommunity: homes ? counts.confirmed / homes : 0,
    sources,
    totalVisitors,
    referralShare: totalBooked ? bookings.filter((b) => b.source === "referral").length / totalBooked : 0,
    money: sumLedger(ledgerRows as LedgerAmounts[]),
    referralCreditsCents: ledgerRows.filter((r) => r.type === "charge").reduce((sum, r) => sum + r.referralCreditCents, 0),
    chargedCount: ledgerRows.filter((r) => r.type === "charge").length,
    ratings: {
      count: ratings.length,
      average: ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null,
      distribution: [1, 2, 3, 4, 5].map((n) => ratings.filter((r) => r.score === n).length),
    },
    waitlist,
    openReviews,
  };
}
