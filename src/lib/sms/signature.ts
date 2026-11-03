import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the full webhook URL followed
 * by every POST param name and value, sorted by name, keyed with the auth token.
 */
export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string): boolean {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
