import { describe, expect, it } from "vitest";
import { smsSegments } from "@/lib/domain/sms";
import type { BookingContext, DealContext } from "@/lib/email/templates";
import { plainText } from "./plain";
import * as S from "./templates";

const d = {
  title: "Gutter Day",
  vendorName: "Summit Gutter Co.",
  serviceDate: new Date("2026-11-14T00:00:00Z"),
  arrivalWindow: "8am–5pm",
} as DealContext;
const b = { name: "Jamie", address: "1240 N 500 E", manageUrl: "https://pavilion.example/b/abc123def456ghi7" } as BookingContext;

describe("text templates", () => {
  const all = [S.bookingConfirmed(d, b), S.reminder(d, b), S.rescheduled(d, b, "Rain is forecast all day."), S.onTheWay(d, b), S.paymentFailed(d, 14900, `${b.manageUrl}/pay`)].map(plainText);

  it("say who they're from", () => {
    for (const t of all) expect(t.startsWith("Pavilion: ")).toBe(true);
  });

  it("stay in the cheap encoding and at most 2 segments", () => {
    for (const t of all) {
      expect(t).toMatch(/^[\x20-\x7E]*$/);
      expect(smsSegments(t)).toBeLessThanOrEqual(2);
    }
  });

  it("tell people how to opt out in the first text", () => {
    expect(all[0]).toContain("Reply STOP to opt out");
  });
});
