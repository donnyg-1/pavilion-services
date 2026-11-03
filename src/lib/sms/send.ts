import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { toE164 } from "@/lib/domain/sms";
import { plainText } from "./plain";

export type TextResidentInput = {
  resident: { phone: string; smsOptIn: boolean };
  body: string;
  template: string;
  dealId?: string | null;
  bookingId?: string | null;
  /** Skip sending if a text with this key was already sent. */
  dedupeKey?: string;
};

/**
 * Texts a resident who opted in (or logs it to the admin Outbox when Twilio isn't
 * configured). Does nothing for residents who didn't opt in or replied STOP.
 * Never throws: a failed text must not undo a booking or a charge.
 */
export async function textResident(input: TextResidentInput): Promise<void> {
  if (!input.resident.smsOptIn) return;
  const to = toE164(input.resident.phone);
  if (!to) return;
  const body = plainText(input.body);
  const dedupeKey = input.dedupeKey ? `sms:${input.dedupeKey}` : undefined;

  try {
    if (dedupeKey && (await db.messageLog.findUnique({ where: { dedupeKey } }))) return;

    let status: "sent" | "logged" | "failed" = "logged";
    let providerId: string | null = null;
    let error: string | null = null;
    if (config.smsMode() === "twilio") {
      const res = await sendViaTwilio(to, body);
      ({ status, providerId, error } = res);
    }

    await db.messageLog.create({
      data: {
        dealId: input.dealId ?? null,
        bookingId: input.bookingId ?? null,
        channel: "sms",
        template: input.template,
        to,
        subject: body.length > 70 ? `${body.slice(0, 67)}...` : body,
        html: "",
        text: body,
        status,
        providerId,
        error,
        dedupeKey,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return;
    console.error(`[sms] failed to send ${input.template} to ${to}`, err);
  }
}

async function sendViaTwilio(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const form = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", process.env.TWILIO_FROM!);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}` },
      body: form,
    });
    const json = (await res.json()) as { sid?: string; message?: string; code?: number };
    if (!res.ok) return { status: "failed" as const, providerId: null, error: `${json.code ?? res.status}: ${json.message ?? "Twilio error"}` };
    return { status: "sent" as const, providerId: json.sid ?? null, error: null };
  } catch (err) {
    return { status: "failed" as const, providerId: null, error: (err as Error).message };
  }
}

