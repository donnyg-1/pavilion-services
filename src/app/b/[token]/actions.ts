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
