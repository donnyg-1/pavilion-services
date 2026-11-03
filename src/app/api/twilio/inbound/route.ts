import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { formatUsPhone, smsKeyword } from "@/lib/domain/sms";
import { validTwilioSignature } from "@/lib/sms/signature";

const twiml = () => new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", { headers: { "Content-Type": "text/xml" } });

/**
 * Twilio calls this when a resident replies to a text. STOP and START update the
 * resident's record so we stop (or resume) texting them. Twilio's own opt-out handling
 * sends the confirmation reply and blocks texts to opted-out numbers, so we reply with nothing.
 */
export async function POST(req: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return new Response("SMS not configured", { status: 404 });

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form) params[k] = String(v);
  // Twilio signs the public URL it was given, which can differ from req.url behind a proxy.
  if (!validTwilioSignature(token, url("/api/twilio/inbound"), params, req.headers.get("x-twilio-signature") ?? "")) {
    return new Response("Bad signature", { status: 403 });
  }

  const phone = formatUsPhone(params.From ?? "");
  const keyword = smsKeyword(params.Body ?? "");
  if (phone && keyword === "stop") {
    await db.resident.updateMany({ where: { phone }, data: { smsOptIn: false, smsOptedOutAt: new Date() } });
  } else if (phone && keyword === "start") {
    await db.resident.updateMany({ where: { phone }, data: { smsOptIn: true, smsOptedOutAt: null, smsConsentAt: new Date() } });
  }
  return twiml();
}
