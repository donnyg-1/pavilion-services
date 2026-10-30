import { describe, expect, it } from "vitest";
import { applyBps, computeChargeLedger, computeRefundLedger, estimateStripeFeeCents, sumLedger, validateRates, type LedgerAmounts, type Rates } from "./ledger";

const defaults: Rates = { commissionBps: 1500, managerShareBps: 400, hoaShareBps: 300, shareBasis: "price" };

function partsAddUp(r: LedgerAmounts) {
  return r.vendorPayoutCents + r.managerShareCents + r.hoaShareCents + r.pavilionNetCents + r.processingFeeCents === r.finalPriceCents;
}

describe("applyBps", () => {
  it("rounds half up to the nearest cent", () => {
    expect(applyBps(14900, 1500)).toBe(2235);
    expect(applyBps(10, 1500)).toBe(2); // 1.5 → 2
    expect(applyBps(9, 1500)).toBe(1); // 1.35 → 1
    expect(applyBps(-10, 1500)).toBe(-2);
  });
});

describe("computeChargeLedger (shares as % of price)", () => {
  it("splits a $149 job with default rates", () => {
    const fee = estimateStripeFeeCents(14900); // 432 + 30
    expect(fee).toBe(462);
    const r = computeChargeLedger(14900, fee, defaults);
    expect(r).toEqual({
      finalPriceCents: 14900,
      commissionCents: 2235, // 15%
      managerShareCents: 596, // 4% of price
      hoaShareCents: 447, // 3% of price
      pavilionNetCents: 1192, // 8%
      processingFeeCents: 462,
      feeAbsorbedCents: 0,
      vendorPayoutCents: 12203, // 14900 − 2235 − 462
    });
    expect(partsAddUp(r)).toBe(true);
  });

  it("deducts processing from the vendor, never from Pavilion's commission", () => {
    const noFee = computeChargeLedger(14900, 0, defaults);
    const withFee = computeChargeLedger(14900, 500, defaults);
    expect(withFee.pavilionNetCents).toBe(noFee.pavilionNetCents);
    expect(withFee.vendorPayoutCents).toBe(noFee.vendorPayoutCents - 500);
  });

  it("includes add-ons in the commissionable price", () => {
    const r = computeChargeLedger(14900 + 2500, 0, defaults);
    expect(r.commissionCents).toBe(2610);
  });
});

describe("computeChargeLedger (shares as % of commission)", () => {
  it("takes manager/HOA shares from the commission amount", () => {
    const r = computeChargeLedger(10000, 0, { ...defaults, managerShareBps: 2500, hoaShareBps: 2000, shareBasis: "commission" });
    expect(r.commissionCents).toBe(1500);
    expect(r.managerShareCents).toBe(375); // 25% of 1500
    expect(r.hoaShareCents).toBe(300); // 20% of 1500
    expect(r.pavilionNetCents).toBe(825);
    expect(partsAddUp(r)).toBe(true);
  });
});

describe("computeChargeLedger: invariants", () => {
  it("always adds up, across many prices and rates", () => {
    const rateSets: Rates[] = [
      defaults,
      { commissionBps: 1250, managerShareBps: 333, hoaShareBps: 333, shareBasis: "price" },
      { commissionBps: 2000, managerShareBps: 5000, hoaShareBps: 5000, shareBasis: "commission" },
      { commissionBps: 0, managerShareBps: 0, hoaShareBps: 0, shareBasis: "price" },
    ];
    for (const rates of rateSets) {
      for (let price = 0; price < 50000; price += 137) {
        const r = computeChargeLedger(price, estimateStripeFeeCents(price), rates);
        expect(partsAddUp(r)).toBe(true);
        expect(r.managerShareCents + r.hoaShareCents).toBeLessThanOrEqual(r.commissionCents);
        expect(r.pavilionNetCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rejects shares bigger than the commission", () => {
    expect(() => computeChargeLedger(10000, 0, { ...defaults, managerShareBps: 1000, hoaShareBps: 600 })).toThrow();
    expect(validateRates({ ...defaults, managerShareBps: 6000, hoaShareBps: 5000, shareBasis: "commission" })).not.toEqual([]);
    expect(validateRates(defaults)).toEqual([]);
  });
});

describe("computeRefundLedger", () => {
  const original = computeChargeLedger(14900, 462, defaults);

  it("fully reverses every party and Pavilion absorbs the kept fee", () => {
    const refund = computeRefundLedger(original, 14900);
    expect(partsAddUp(refund)).toBe(true);
    const net = sumLedger([original, refund]);
    expect(net.finalPriceCents).toBe(0);
    expect(net.vendorPayoutCents).toBe(0);
    expect(net.managerShareCents).toBe(0);
    expect(net.hoaShareCents).toBe(0);
    expect(net.processingFeeCents).toBe(462); // Stripe kept it
    expect(net.pavilionNetCents).toBe(-462); // and Pavilion paid for it
    expect(refund.feeAbsorbedCents).toBe(462);
  });

  it("handles partial refunds that add up exactly to a full refund", () => {
    const r1 = computeRefundLedger(original, 5000, 0);
    const r2 = computeRefundLedger(original, 3333, 5000);
    const r3 = computeRefundLedger(original, 14900 - 8333, 8333);
    for (const r of [r1, r2, r3]) expect(partsAddUp(r)).toBe(true);
    const net = sumLedger([original, r1, r2, r3]);
    expect(net.vendorPayoutCents).toBe(0);
    expect(net.managerShareCents).toBe(0);
    expect(net.hoaShareCents).toBe(0);
    expect(net.pavilionNetCents).toBe(-462);
  });

  it("refuses to refund more than was charged", () => {
    expect(() => computeRefundLedger(original, 15000)).toThrow();
    expect(() => computeRefundLedger(original, 5000, 10000)).toThrow();
    expect(() => computeRefundLedger(original, 0)).toThrow();
  });
});

describe("referral credit split with the vendor", () => {
  it("comes off the price charged, so every party's share shrinks proportionally", () => {
    const full = computeChargeLedger(14900, 0, defaults);
    const credited = computeChargeLedger(14900 - 1000, 0, defaults); // $10 referral credit
    expect(full.finalPriceCents - credited.finalPriceCents).toBe(1000);
    expect(full.commissionCents - credited.commissionCents).toBe(150); // 15% of the $10
    expect(full.managerShareCents - credited.managerShareCents).toBe(40);
    expect(full.hoaShareCents - credited.hoaShareCents).toBe(30);
    expect(full.vendorPayoutCents - credited.vendorPayoutCents).toBe(850);
    expect(partsAddUp(credited)).toBe(true);
  });
});
