"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cancelBooking } from "@/lib/services/booking";

export async function cancelMyBooking(token: string) {
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking) return { ok: false as const, message: "Booking not found." };
  const r = await cancelBooking(booking.id, "resident");
  revalidatePath(`/b/${token}`);
  return r;
}

export async function saveNotes(token: string, notes: string) {
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking || booking.status !== "booked") return { ok: false as const, message: "Notes can't be changed on this booking anymore." };
  await db.booking.update({ where: { id: booking.id }, data: { notes: notes.trim().slice(0, 500) } });
  revalidatePath(`/b/${token}`);
  return { ok: true as const, message: "Saved. The crew will see this." };
}

/** The resident turns service-day texts on or off from their booking page. */
export async function setTexts(token: string, on: boolean) {
  const booking = await db.booking.findUnique({ where: { publicToken: token } });
  if (!booking) return { ok: false as const, message: "Booking not found." };
  await db.resident.update({
    where: { id: booking.residentId },
    data: on ? { smsOptIn: true, smsConsentAt: new Date(), smsOptedOutAt: null } : { smsOptIn: false, smsOptedOutAt: new Date() },
  });
  revalidatePath(`/b/${token}`);
  return { ok: true as const, message: on ? "Texts are on." : "Texts are off. We'll still email you." };
}
