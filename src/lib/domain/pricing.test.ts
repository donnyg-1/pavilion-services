import { describe, expect, it } from "vitest";
import { bookingTotalCents, currentPriceCents, nextTier, referralCreditCents, referralsUntilCap, tierForCount, tierUnlockedBetween, validateTiers } from "./pricing";

const tiers = [
  { minHomes: 10, priceCents: 12900 },
  { minHomes: 1, priceCents: 16900 },
  { minHomes: 5, priceCents: 14900 },
];

describe("tierForCount", () => {
  it("uses the first tier before anyone books", () => {
    expect(tierForCount(tiers, 0).priceCents).toBe(16900);
  });
  it("picks the highest tier reached, regardless of input order", () => {
    expect(tierForCount(tiers, 1).priceCents).toBe(16900);
    expect(tierForCount(tiers, 4).priceCents).toBe(16900);
    expect(tierForCount(tiers, 5).priceCents).toBe(14900);
    expect(tierForCount(tiers, 9).priceCents).toBe(14900);
    expect(tierForCount(tiers, 10).priceCents).toBe(12900);
    expect(tierForCount(tiers, 250).priceCents).toBe(12900);
  });
  it("throws with no tiers", () => {
    expect(() => tierForCount([], 3)).toThrow();
  });
});

describe("nextTier", () => {
  it("says how many more homes unlock the next price", () => {
    expect(nextTier(tiers, 2)).toEqual({ tier: { minHomes: 5, priceCents: 14900 }, homesNeeded: 3 });
    expect(nextTier(tiers, 0)).toEqual({ tier: { minHomes: 5, priceCents: 14900 }, homesNeeded: 5 });
    expect(nextTier(tiers, 7)?.homesNeeded).toBe(3);
  });
  it("returns null at the lowest price", () => {
    expect(nextTier(tiers, 10)).toBeNull();
    expect(nextTier(tiers, 40)).toBeNull();
  });
});

describe("currentPriceCents", () => {
  it("prices off the peak count so cancellations never raise the price", () => {
    // 6 homes booked at peak, two cancelled → live count 4, price stays at the 5-home tier
    expect(currentPriceCents({ tiers, peakBookedCount: 6, lockedPriceCents: null })).toBe(14900);
  });
  it("uses the locked price once signups close", () => {
    expect(currentPriceCents({ tiers, peakBookedCount: 12, lockedPriceCents: 14900 })).toBe(14900);
  });
});

describe("tierUnlockedBetween", () => {
  it("reports a newly unlocked tier", () => {
    expect(tierUnlockedBetween(tiers, 4, 5)?.priceCents).toBe(14900);
    expect(tierUnlockedBetween(tiers, 9, 10)?.priceCents).toBe(12900);
  });
  it("reports nothing within a tier or when the count goes down", () => {
    expect(tierUnlockedBetween(tiers, 5, 6)).toBeNull();
    expect(tierUnlockedBetween(tiers, 10, 9)).toBeNull();
    expect(tierUnlockedBetween(tiers, 0, 1)).toBeNull();
  });
});

describe("validateTiers", () => {
  it("accepts a sensible table", () => {
    expect(validateTiers(tiers, 19900)).toEqual([]);
  });
  it("requires prices to drop at each tier", () => {
    expect(validateTiers([{ minHomes: 1, priceCents: 100 }, { minHomes: 5, priceCents: 100 }], 200)).toContain(
      "Each tier must be cheaper than the one before it.",
    );
  });
  it("requires a starting tier at 0 or 1 homes", () => {
    expect(validateTiers([{ minHomes: 3, priceCents: 100 }], 200).length).toBeGreaterThan(0);
  });
  it("rejects duplicate thresholds, empty tables and prices above normal", () => {
    expect(validateTiers([], 100)).toHaveLength(1);
    expect(validateTiers([{ minHomes: 1, priceCents: 100 }, { minHomes: 1, priceCents: 90 }], 200)).toContain("Two tiers start at 1 homes.");
    expect(validateTiers([{ minHomes: 1, priceCents: 300 }], 200)).toContain("The starting deal price can't be higher than the normal price.");
  });
});

describe("bookingTotalCents", () => {
  it("adds flat-price add-ons to the tier price", () => {
    expect(bookingTotalCents(14900, [2500, 1500])).toBe(18900);
    expect(bookingTotalCents(14900, [])).toBe(14900);
  });
});

describe("referralCreditCents", () => {
  const base = { perReferralCents: 500, capCents: 2500, jobTotalCents: 14900 };
  it("gives $5 per neighbor", () => {
    expect(referralCreditCents({ ...base, referrals: 0 })).toBe(0);
    expect(referralCreditCents({ ...base, referrals: 1 })).toBe(500);
    expect(referralCreditCents({ ...base, referrals: 3 })).toBe(1500);
  });
  it("stops at the cap", () => {
    expect(referralCreditCents({ ...base, referrals: 5 })).toBe(2500);
    expect(referralCreditCents({ ...base, referrals: 12 })).toBe(2500);
  });
  it("never takes the charge below Stripe's minimum", () => {
    expect(referralCreditCents({ ...base, referrals: 5, jobTotalCents: 2000 })).toBe(1950);
    expect(referralCreditCents({ ...base, referrals: 5, jobTotalCents: 40 })).toBe(0);
  });
  it("is off when the deal sets $0", () => {
    expect(referralCreditCents({ ...base, perReferralCents: 0, referrals: 4 })).toBe(0);
  });
});

describe("referralsUntilCap", () => {
  it("counts the referrals left that still earn credit", () => {
    expect(referralsUntilCap(0, 500, 2500)).toBe(5);
    expect(referralsUntilCap(3, 500, 2500)).toBe(2);
    expect(referralsUntilCap(7, 500, 2500)).toBe(0);
    expect(referralsUntilCap(0, 0, 2500)).toBe(0);
  });
});
