"use server";

import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { finalizeBooking, joinWaitlist, prepareBooking, requestAddressReview, type BookingResult } from "@/lib/services/booking";

export type Contact = { name: string; email: string; phone: string; street: string; unit: string };
export type BookingInput = Contact & { notes: string; addOnIds: string[] };

export async function prepare(slug: string, input: BookingInput, attribution: { src: string | null; ref: string | null }): Promise<BookingResult> {
  return prepareBooking(slug, input, attribution);
}

export async function finalize(token: string, ref: string) {
  return finalizeBooking(token, ref);
}

export async function submitWaitlist(slug: string, contact: Contact, src: string | null, ref: string | null) {
  return joinWaitlist(slug, contact, src, ref);
}

export async function submitReview(slug: string, contact: Contact) {
  return requestAddressReview(slug, contact);
}

/** Mock mode only: what a phone wallet would hand over, using an address that's still free. */
export async function mockWalletIdentity(slug: string): Promise<Contact | null> {
  if (config.paymentsMode() !== "mock") return null;
  const deal = await db.deal.findUnique({ where: { slug } });
  if (!deal) return null;
  const free = await db.communityAddress.findFirst({
    where: { communityId: deal.communityId, active: true, bookings: { none: { dealId: deal.id, status: { in: ["pending_setup", "booked", "completed", "charged", "failed"] } } } },
    orderBy: { normalized: "desc" },
  });
  if (!free) return null;
  const n = Math.floor(Math.random() * 9000) + 1000;
  return { name: "Jamie Wallet", email: `jamie.wallet.${n}@example.com`, phone: `(801) 555-${n}`, street: free.raw, unit: "" };
}
