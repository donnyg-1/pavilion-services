// Capacity, waitlist, signup window and cancellation rules.

export type BookingStatusName =
  | "pending_setup"
  | "booked"
  | "cancelled"
  | "completed"
  | "charged"
  | "failed"
  | "refunded"
  | "expired";

/** Statuses that count as a confirmed home (shown as "homes booked", drive tier pricing). */
export const CONFIRMED_STATUSES = ["booked", "completed", "charged", "failed", "refunded"] as const satisfies BookingStatusName[];

/** Whether a booking takes up one of the vendor's spots right now. */
export function holdsSpot(b: { status: BookingStatusName; holdExpiresAt: Date | null }, now: Date): boolean {
  if (b.status === "pending_setup") return b.holdExpiresAt != null && b.holdExpiresAt > now;
  return b.status !== "cancelled" && b.status !== "expired" && b.status !== "refunded";
}

export function spotsLeft(capacity: number, spotsTaken: number): number {
  return Math.max(0, capacity - spotsTaken);
}

export type SignupWindow = "draft" | "open" | "closed";

export function signupWindow(deal: { status: string; signupDeadline: Date }, now: Date): SignupWindow {
  if (deal.status === "draft") return "draft";
  if (deal.status !== "open") return "closed";
  return now < deal.signupDeadline ? "open" : "closed";
}

export type BookingDecision =
  | { ok: true }
  | { ok: false; reason: "draft" | "closed" | "not_on_list" | "already_booked" | "full" };

/**
 * Decides whether a booking attempt can go ahead. Order matters: a closed deal or an
 * address that isn't eligible is reported before "full", so we never waitlist someone
 * who couldn't book anyway.
 */
export function decideBooking(input: {
  window: SignupWindow;
  addressOnList: boolean;
  addressAlreadyBooked: boolean;
  capacity: number;
  spotsTaken: number;
}): BookingDecision {
  if (input.window === "draft") return { ok: false, reason: "draft" };
  if (input.window === "closed") return { ok: false, reason: "closed" };
  if (!input.addressOnList) return { ok: false, reason: "not_on_list" };
  if (input.addressAlreadyBooked) return { ok: false, reason: "already_booked" };
  if (spotsLeft(input.capacity, input.spotsTaken) <= 0) return { ok: false, reason: "full" };
  return { ok: true };
}

/** Residents can cancel themselves until signups close. */
export function residentCanCancel(status: BookingStatusName, signupDeadline: Date, now: Date): boolean {
  return (status === "booked" || status === "pending_setup") && now < signupDeadline;
}

/** A spot opening up should notify the waitlist only while signups are still open. */
export function shouldNotifyWaitlist(input: {
  window: SignupWindow;
  capacity: number;
  spotsTakenBefore: number;
  spotsTakenAfter: number;
}): boolean {
  return (
    input.window === "open" &&
    spotsLeft(input.capacity, input.spotsTakenBefore) === 0 &&
    spotsLeft(input.capacity, input.spotsTakenAfter) > 0
  );
}
