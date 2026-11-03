import { describe, expect, it } from "vitest";
import { vendorReadiness } from "./vendor";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const complete = { insuranceExpiresAt: d("2027-06-30"), agreementSignedAt: d("2026-11-01"), payoutDetailsAt: d("2026-11-01") };
const gutterDay = { serviceDate: d("2026-11-23"), backupDate: d("2026-11-30") };

describe("vendorReadiness", () => {
  it("is ready when all three items are on file and insurance covers both dates", () => {
    expect(vendorReadiness(complete, "2026-11-03", gutterDay)).toEqual({ ready: true, missing: [], warnings: [] });
  });

  it("lists everything that's missing for a brand-new vendor", () => {
    const r = vendorReadiness({ insuranceExpiresAt: null, agreementSignedAt: null, payoutDetailsAt: null }, "2026-11-03");
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["Insurance certificate", "Signed vendor agreement", "Bank details for payouts"]);
  });

  it("blocks expired insurance", () => {
    const r = vendorReadiness({ ...complete, insuranceExpiresAt: d("2026-10-31") }, "2026-11-03", gutterDay);
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["Insurance expired Oct 31, 2026"]);
  });

  it("blocks insurance that lapses before the service day", () => {
    const r = vendorReadiness({ ...complete, insuranceExpiresAt: d("2026-11-22") }, "2026-11-03", gutterDay);
    expect(r.ready).toBe(false);
    expect(r.missing[0]).toContain("before the service day");
  });

  it("counts insurance that ends on the service day as covering it", () => {
    expect(vendorReadiness({ ...complete, insuranceExpiresAt: d("2026-11-23") }, "2026-11-03", { serviceDate: d("2026-11-23"), backupDate: null }).ready).toBe(true);
  });

  it("only warns when insurance lapses before the rain date", () => {
    const r = vendorReadiness({ ...complete, insuranceExpiresAt: d("2026-11-25") }, "2026-11-03", gutterDay);
    expect(r.ready).toBe(true);
    expect(r.warnings).toEqual(["Insurance expires Nov 25, 2026, before the rain date"]);
  });

  it("checks only today's date when there's no deal yet", () => {
    expect(vendorReadiness({ ...complete, insuranceExpiresAt: d("2026-11-10") }, "2026-11-03").ready).toBe(true);
  });
});
