import { describe, expect, it } from "vitest";
import { decideBooking, holdsSpot, residentCanCancel, shouldNotifyWaitlist, signupWindow, spotsLeft } from "./capacity";

const now = new Date("2026-11-10T12:00:00Z");
const later = new Date("2026-11-15T12:00:00Z");
const earlier = new Date("2026-11-01T12:00:00Z");

describe("holdsSpot", () => {
  it("counts a pending booking only while its hold is live", () => {
    expect(holdsSpot({ status: "pending_setup", holdExpiresAt: later }, now)).toBe(true);
    expect(holdsSpot({ status: "pending_setup", holdExpiresAt: earlier }, now)).toBe(false);
    expect(holdsSpot({ status: "pending_setup", holdExpiresAt: null }, now)).toBe(false);
  });
  it("counts booked and post-service statuses, not cancelled/expired/refunded", () => {
    for (const s of ["booked", "completed", "charged", "failed"] as const) expect(holdsSpot({ status: s, holdExpiresAt: null }, now)).toBe(true);
    for (const s of ["cancelled", "expired", "refunded"] as const) expect(holdsSpot({ status: s, holdExpiresAt: null }, now)).toBe(false);
  });
});

describe("spotsLeft", () => {
  it("never goes negative", () => {
    expect(spotsLeft(30, 12)).toBe(18);
    expect(spotsLeft(30, 30)).toBe(0);
    expect(spotsLeft(30, 31)).toBe(0);
  });
});

describe("signupWindow", () => {
  it("is open only for open deals before the deadline", () => {
    expect(signupWindow({ status: "open", signupDeadline: later }, now)).toBe("open");
    expect(signupWindow({ status: "open", signupDeadline: earlier }, now)).toBe("closed");
    expect(signupWindow({ status: "open", signupDeadline: now }, now)).toBe("closed");
    expect(signupWindow({ status: "draft", signupDeadline: later }, now)).toBe("draft");
    expect(signupWindow({ status: "completed", signupDeadline: later }, now)).toBe("closed");
  });
});

describe("decideBooking", () => {
  const base = { window: "open" as const, addressOnList: true, addressAlreadyBooked: false, capacity: 30, spotsTaken: 10 };

  it("allows a valid booking", () => {
    expect(decideBooking(base)).toEqual({ ok: true });
  });
  it("sends people to the waitlist at capacity", () => {
    expect(decideBooking({ ...base, spotsTaken: 30 })).toEqual({ ok: false, reason: "full" });
    expect(decideBooking({ ...base, spotsTaken: 29 })).toEqual({ ok: true });
  });
  it("checks the address before capacity, so ineligible homes aren't waitlisted", () => {
    expect(decideBooking({ ...base, addressOnList: false, spotsTaken: 30 })).toEqual({ ok: false, reason: "not_on_list" });
  });
  it("blocks a second booking for the same address", () => {
    expect(decideBooking({ ...base, addressAlreadyBooked: true })).toEqual({ ok: false, reason: "already_booked" });
  });
  it("blocks when closed or still a draft", () => {
    expect(decideBooking({ ...base, window: "closed" })).toEqual({ ok: false, reason: "closed" });
    expect(decideBooking({ ...base, window: "draft" })).toEqual({ ok: false, reason: "draft" });
  });
});

describe("residentCanCancel", () => {
  it("works until the deadline for booked homes", () => {
    expect(residentCanCancel("booked", later, now)).toBe(true);
    expect(residentCanCancel("booked", earlier, now)).toBe(false);
    expect(residentCanCancel("charged", later, now)).toBe(false);
    expect(residentCanCancel("cancelled", later, now)).toBe(false);
  });
});

describe("shouldNotifyWaitlist", () => {
  it("fires only when a full deal gets a spot back while open", () => {
    expect(shouldNotifyWaitlist({ window: "open", capacity: 30, spotsTakenBefore: 30, spotsTakenAfter: 29 })).toBe(true);
    expect(shouldNotifyWaitlist({ window: "open", capacity: 30, spotsTakenBefore: 29, spotsTakenAfter: 28 })).toBe(false);
    expect(shouldNotifyWaitlist({ window: "closed", capacity: 30, spotsTakenBefore: 30, spotsTakenAfter: 29 })).toBe(false);
  });
});
