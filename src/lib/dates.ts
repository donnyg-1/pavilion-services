// Pavilion operates in Utah. Timestamps (deadlines) display in Mountain time.
// Service dates are date-only columns stored as UTC midnight, so they format in UTC.

export const TZ = "America/Denver";

export function formatServiceDate(d: Date, style: "long" | "short" = "long"): string {
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  });
}

export function formatDeadline(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** YYYY-MM-DD for a date-only column. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parses "YYYY-MM-DD" into a UTC-midnight Date for a date-only column. */
export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function zoneOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** "2026-11-16T20:00" in Mountain time → UTC Date. */
export function mountainLocalToUtc(local: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - zoneOffsetMs(guess, TZ);
  utc = guess - zoneOffsetMs(utc, TZ); // second pass handles DST edges
  return new Date(utc);
}

/** UTC Date → "2026-11-16T20:00" in Mountain time, for <input type="datetime-local">. */
export function utcToMountainLocal(d: Date): string {
  const shifted = new Date(d.getTime() + zoneOffsetMs(d.getTime(), TZ));
  return shifted.toISOString().slice(0, 16);
}

/** Today's date in Mountain time as YYYY-MM-DD. */
export function mountainToday(now = new Date()): string {
  return utcToMountainLocal(now).slice(0, 10);
}

export function addDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
