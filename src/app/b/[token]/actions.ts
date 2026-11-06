"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cancelBooking, setBookingTexts } from "@/lib/services/booking";
import { setNextTime } from "@/lib/services/next-time";

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
  const r = await setBookingTexts(token, on);
  revalidatePath(`/b/${token}`);
  return r;
}

/** "Save my spot for next time" after the job. Interest only: nothing is booked or charged. */
export async function saveSpot(token: string, on: boolean) {
  const r = await setNextTime(token, on);
  revalidatePath(`/b/${token}`);
  return r;
}
