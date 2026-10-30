import { randomBytes } from "node:crypto";

/** URL-safe secret for confirmation / cancel / rating links. */
export function publicToken(): string {
  return randomBytes(18).toString("base64url");
}

// No 0/O, 1/I/L, so codes survive being read aloud or typed from a flyer.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function referralCode(length = 6): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
