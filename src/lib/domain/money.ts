export function formatCents(cents: number, opts: { showZeroCents?: boolean } = {}): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars) && !opts.showZeroCents;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** "$149", "149.50", "149" → cents. Returns null for anything that isn't a valid amount. */
export function parseDollars(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** "15", "15.5", "15%" → basis points. */
export function parsePercent(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
