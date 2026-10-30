// Group pricing: the price drops as more homes book, and never goes back up.

export type Tier = { minHomes: number; priceCents: number };

export function sortTiers<T extends Tier>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => a.minHomes - b.minHomes);
}

/** Returns a list of human-readable problems; empty means the tier table is valid. */
export function validateTiers(tiers: Tier[], normalPriceCents: number): string[] {
  const errors: string[] = [];
  if (tiers.length === 0) return ["Add at least one price tier."];

  const sorted = sortTiers(tiers);
  if (sorted[0].minHomes > 1) {
    errors.push("The first tier must start at 0 or 1 homes so there's always a price.");
  }
  for (const t of sorted) {
    if (!Number.isInteger(t.minHomes) || t.minHomes < 0) errors.push("Home counts must be whole numbers, 0 or more.");
    if (!Number.isInteger(t.priceCents) || t.priceCents <= 0) errors.push("Tier prices must be greater than $0.");
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minHomes === sorted[i - 1].minHomes) {
      errors.push(`Two tiers start at ${sorted[i].minHomes} homes.`);
    } else if (sorted[i].priceCents >= sorted[i - 1].priceCents) {
      errors.push("Each tier must be cheaper than the one before it.");
    }
  }
  if (sorted[0].priceCents > normalPriceCents) {
    errors.push("The starting deal price can't be higher than the normal price.");
  }
  return [...new Set(errors)];
}

/** The tier that applies when `count` homes have booked. Below the first tier, the first tier applies. */
export function tierForCount<T extends Tier>(tiers: T[], count: number): T {
  const sorted = sortTiers(tiers);
  if (sorted.length === 0) throw new Error("Deal has no price tiers");
  let current = sorted[0];
  for (const t of sorted) {
    if (count >= t.minHomes) current = t;
  }
  return current;
}

/** The next cheaper tier and how many more homes it needs, or null at the bottom tier. */
export function nextTier<T extends Tier>(tiers: T[], count: number): { tier: T; homesNeeded: number } | null {
  const next = sortTiers(tiers).find((t) => t.minHomes > count && t.minHomes > tierForCount(tiers, count).minHomes);
  return next ? { tier: next, homesNeeded: next.minHomes - count } : null;
}

export type PricedDeal = {
  tiers: Tier[];
  peakBookedCount: number;
  lockedPriceCents: number | null;
};

/**
 * The deal's current price. Tiers unlock off the peak booked count (not the live count),
 * so cancellations never raise the price. Once locked at the deadline, the locked price wins.
 */
export function currentPriceCents(deal: PricedDeal): number {
  if (deal.lockedPriceCents != null) return deal.lockedPriceCents;
  return tierForCount(deal.tiers, deal.peakBookedCount).priceCents;
}

/** Returns the tier newly unlocked by moving from `before` to `after` homes, if any. */
export function tierUnlockedBetween<T extends Tier>(tiers: T[], before: number, after: number): T | null {
  if (after <= before) return null;
  const was = tierForCount(tiers, before);
  const now = tierForCount(tiers, after);
  return now.minHomes > was.minHomes ? now : null;
}

export function bookingTotalCents(basePriceCents: number, addOnPricesCents: number[]): number {
  return addOnPricesCents.reduce((sum, p) => sum + p, basePriceCents);
}

/** Stripe won't charge less than this, so a referral credit always leaves at least 50¢. */
export const MIN_CHARGE_CENTS = 50;

/**
 * Referral credit for a home: per-referral amount × neighbors who booked with its link,
 * capped per home, and never more than the job itself.
 */
export function referralCreditCents(input: { referrals: number; perReferralCents: number; capCents: number; jobTotalCents: number }): number {
  const { referrals, perReferralCents, capCents, jobTotalCents } = input;
  if (referrals <= 0 || perReferralCents <= 0) return 0;
  const earned = Math.min(referrals * perReferralCents, Math.max(0, capCents));
  return Math.max(0, Math.min(earned, jobTotalCents - MIN_CHARGE_CENTS));
}

/** How many more referrals still earn credit before the cap. */
export function referralsUntilCap(referrals: number, perReferralCents: number, capCents: number): number {
  if (perReferralCents <= 0) return 0;
  return Math.max(0, Math.ceil(capCents / perReferralCents) - referrals);
}
