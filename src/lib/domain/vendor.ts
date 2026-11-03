// Whether a vendor is cleared to take bookings. Signups can't open for a deal until
// its vendor's paperwork is on file and their insurance covers the service day.

export type VendorPaperwork = {
  insuranceExpiresAt: Date | null; // date-only (UTC midnight)
  agreementSignedAt: Date | null;
  payoutDetailsAt: Date | null;
};

export type Readiness = {
  ready: boolean;
  /** Blocks opening signups. */
  missing: string[];
  /** Worth fixing, but doesn't block. */
  warnings: string[];
};

const day = (d: Date) => d.toISOString().slice(0, 10);
const label = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

/**
 * `today` is the Mountain-time date as YYYY-MM-DD. Service and backup dates are
 * date-only columns, so everything compares as calendar days.
 */
export function vendorReadiness(v: VendorPaperwork, today: string, dates?: { serviceDate: Date; backupDate: Date | null }): Readiness {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!v.insuranceExpiresAt) missing.push("Insurance certificate");
  else if (day(v.insuranceExpiresAt) < today) missing.push(`Insurance expired ${label(v.insuranceExpiresAt)}`);
  else if (dates && day(v.insuranceExpiresAt) < day(dates.serviceDate)) missing.push(`Insurance expires ${label(v.insuranceExpiresAt)}, before the service day`);
  else if (dates?.backupDate && day(v.insuranceExpiresAt) < day(dates.backupDate)) warnings.push(`Insurance expires ${label(v.insuranceExpiresAt)}, before the rain date`);

  if (!v.agreementSignedAt) missing.push("Signed vendor agreement");
  if (!v.payoutDetailsAt) missing.push("Bank details for payouts");

  return { ready: missing.length === 0, missing, warnings };
}
