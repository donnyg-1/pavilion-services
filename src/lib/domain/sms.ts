// Text message rules that don't touch the database: phone formatting, opt-out
// keywords, and when automated reminders are allowed to go out.

/** "(801) 555-1234" → "+18015551234". Returns null for anything that isn't a 10-digit US number. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10 || /^[01]/.test(digits)) return null;
  return `+1${digits}`;
}

// Carrier-standard keywords (CTIA). Twilio also honors these on its side; we mirror them
// so the resident's record and the admin view stay accurate.
const STOP = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "revoke"];
const START = ["start", "unstop", "yes", "subscribe"];
const HELP = ["help", "info"];

export function smsKeyword(body: string): "stop" | "start" | "help" | null {
  const word = body.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (STOP.includes(word)) return "stop";
  if (START.includes(word)) return "start";
  if (HELP.includes(word)) return "help";
  return null;
}

/** Hour of day (0–23) in Mountain time. */
export function mountainHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", hourCycle: "h23" }).format(now));
}

/** Automated reminders only go out 8am–9pm Mountain. Texts a person triggers (crew on the way, weather) can go anytime. */
export function isTextingHours(now: Date): boolean {
  const h = mountainHour(now);
  return h >= 8 && h < 21;
}

/** How many SMS segments a message bills as (GSM-7: 160, or 153 per part; anything else: 70 / 67). */
export function smsSegments(body: string): number {
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\x0A\x0D\x20-\x5F\x61-\x7E£¥èéùìòÇØøÅåÄÖÑÜ§äöñüà]*$/.test(body);
  const [single, multi] = gsm ? [160, 153] : [70, 67];
  return body.length <= single ? 1 : Math.ceil(body.length / multi);
}

/** "+18015551234" → "(801) 555-1234", the format phone numbers are stored in. */
export function formatUsPhone(e164: string): string | null {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : null;
}
