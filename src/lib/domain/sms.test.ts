import { describe, expect, it } from "vitest";
import { isTextingHours, smsKeyword, smsSegments, toE164 } from "./sms";

describe("toE164", () => {
  it("formats US numbers however they were typed", () => {
    expect(toE164("(801) 555-1234")).toBe("+18015551234");
    expect(toE164("801.555.1234")).toBe("+18015551234");
    expect(toE164("+1 801 555 1234")).toBe("+18015551234");
    expect(toE164("18015551234")).toBe("+18015551234");
  });

  it("rejects numbers that can't be texted", () => {
    expect(toE164("555-1234")).toBeNull();
    expect(toE164("(011) 555-1234")).toBeNull(); // area codes never start with 0 or 1
    expect(toE164("")).toBeNull();
  });
});

describe("smsKeyword", () => {
  it("recognizes opt-out, opt-in and help words in any case or punctuation", () => {
    expect(smsKeyword("STOP")).toBe("stop");
    expect(smsKeyword(" stop. ")).toBe("stop");
    expect(smsKeyword("Unsubscribe")).toBe("stop");
    expect(smsKeyword("START")).toBe("start");
    expect(smsKeyword("help")).toBe("help");
  });

  it("ignores normal replies", () => {
    expect(smsKeyword("Can you come after 10?")).toBeNull();
    expect(smsKeyword("stop by the side gate")).toBeNull();
  });
});

describe("isTextingHours", () => {
  it("allows 8am to 9pm Mountain only", () => {
    // Nov 3, 2026 is MST (UTC−7).
    expect(isTextingHours(new Date("2026-11-03T14:59:00Z"))).toBe(false); // 7:59am
    expect(isTextingHours(new Date("2026-11-03T15:00:00Z"))).toBe(true); // 8:00am
    expect(isTextingHours(new Date("2026-11-04T03:59:00Z"))).toBe(true); // 8:59pm
    expect(isTextingHours(new Date("2026-11-04T04:00:00Z"))).toBe(false); // 9:00pm
    // July is MDT (UTC−6).
    expect(isTextingHours(new Date("2026-07-01T14:00:00Z"))).toBe(true); // 8:00am
  });

  it("covers the daily cron time", () => {
    expect(isTextingHours(new Date("2026-11-03T16:00:00Z"))).toBe(true);
    expect(isTextingHours(new Date("2026-07-01T16:00:00Z"))).toBe(true);
  });
});

describe("smsSegments", () => {
  it("counts billing segments", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("Gutter Day — tomorrow")).toBe(1); // em dash forces UCS-2, still short
    expect(smsSegments("—".repeat(71))).toBe(2);
  });
});
