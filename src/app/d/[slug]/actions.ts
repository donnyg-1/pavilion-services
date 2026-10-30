"use server";

import { redirect } from "next/navigation";
import { joinWaitlist, requestAddressReview, startBooking, type BookingResult } from "@/lib/services/booking";

export type Contact = { name: string; email: string; phone: string; street: string; unit: string };

export type BookingFormState = { result: BookingResult | null; at: number };

export async function submitBooking(slug: string, _prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    street: formData.get("street"),
    unit: formData.get("unit") ?? "",
    notes: formData.get("notes") ?? "",
    addOnIds: formData.getAll("addOn").map(String),
    agreed: formData.get("agreed") === "on",
  };
  const result = await startBooking(slug, raw, { src: formData.get("src") as string | null, ref: formData.get("ref") as string | null });
  if (result.kind === "redirect") redirect(result.url);
  return { result, at: Date.now() };
}

export async function submitWaitlist(slug: string, contact: Contact, src: string | null, ref: string | null) {
  return joinWaitlist(slug, contact, src, ref);
}

export async function submitReview(slug: string, contact: Contact) {
  return requestAddressReview(slug, contact);
}
