// Text message copy. Plain ASCII on purpose: one curly quote or dash switches a text to
// UCS-2 and can double what each one costs. Every text starts with "Pavilion:" so the
// resident knows who it's from (carriers require it).

import { formatServiceDate } from "@/lib/dates";
import { formatCents } from "@/lib/domain/money";
import type { BookingContext, DealContext } from "@/lib/email/templates";

const day = (d: Date) => formatServiceDate(d, "short");
const arrival = (d: DealContext) => (d.arrivalWindow ? `, ${d.arrivalWindow}` : "");

export function bookingConfirmed(d: DealContext, b: BookingContext): string {
  return `Pavilion: You're booked for ${d.title} on ${day(d.serviceDate)}. We'll text you the day before. Your booking: ${b.manageUrl} Reply STOP to opt out.`;
}

export function reminder(d: DealContext, b: BookingContext): string {
  return `Pavilion: Reminder, ${d.vendorName} comes tomorrow (${day(d.serviceDate)}${arrival(d)}) for ${d.title}. No need to be home. Please unlock side gates and keep pets in. ${b.manageUrl}`;
}

export function rescheduled(d: DealContext, b: BookingContext, note: string): string {
  const why = note ? ` ${note.trim().replace(/[^\x20-\x7E]/g, "")}` : "";
  return `Pavilion: ${d.title} moved to ${day(d.serviceDate)}.${why} Your booking and price stay the same. ${b.manageUrl}`;
}

export function onTheWay(d: DealContext, b: BookingContext): string {
  return `Pavilion: The ${d.vendorName} crew is on the way to ${b.address} for ${d.title}. Please unlock side gates and keep pets in.`;
}

export function paymentFailed(d: DealContext, amountCents: number, payUrl: string): string {
  return `Pavilion: Thanks for booking ${d.title}! Your card didn't go through for ${formatCents(amountCents)}. Pay securely here: ${payUrl}`;
}
