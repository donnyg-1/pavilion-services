"use server";

import { db } from "@/lib/db";

export async function saveRating(token: string, score: number, comment?: string) {
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false as const };
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking || !["charged", "completed", "failed", "refunded"].includes(booking.status)) return { ok: false as const };
  await db.rating.upsert({
    where: { bookingId: booking.id },
    create: { bookingId: booking.id, score, comment: comment?.slice(0, 1000) ?? "" },
    update: { score, ...(comment !== undefined ? { comment: comment.slice(0, 1000) } : {}) },
  });
  return { ok: true as const };
}
