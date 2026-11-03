import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validTwilioSignature } from "./signature";

const url = "https://pavilion.example/api/twilio/inbound";
const params = { From: "+18015550111", Body: "STOP", To: "+18015550000" };
// Twilio's scheme: URL + params sorted by name, each as name+value, HMAC-SHA1 with the auth token.
const sign = (token: string) => createHmac("sha1", token).update(`${url}BodySTOPFrom+18015550111To+18015550000`).digest("base64");

describe("validTwilioSignature", () => {
  it("accepts a request Twilio signed", () => {
    expect(validTwilioSignature("secret", url, params, sign("secret"))).toBe(true);
  });

  it("rejects a wrong token, a changed param or a missing signature", () => {
    expect(validTwilioSignature("secret", url, params, sign("other"))).toBe(false);
    expect(validTwilioSignature("secret", url, { ...params, Body: "START" }, sign("secret"))).toBe(false);
    expect(validTwilioSignature("secret", url, params, "")).toBe(false);
  });
});
