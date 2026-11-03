import { Resend } from "resend";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import type { EmailContent } from "./templates";

let resend: Resend | null = null;

export type SendEmailInput = EmailContent & {
  to: string;
  template: string;
  dealId?: string | null;
  bookingId?: string | null;
  /** Skip sending if a message with this key was already sent (reminders, tier-unlock blasts). */
  dedupeKey?: string;
  /** Text attachments, e.g. the vendor's route CSV. Not stored in the Outbox. */
  attachments?: { filename: string; content: string }[];
};

/**
 * Sends an email (or logs it to the admin Outbox when Resend isn't configured).
 * Never throws: a failed email must not undo a booking or a charge.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    if (input.dedupeKey) {
      const existing = await db.messageLog.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return;
    }

    let status: "sent" | "logged" | "failed" = "logged";
    let providerId: string | null = null;
    let error: string | null = null;

    if (config.emailMode() === "resend") {
      resend ??= new Resend(process.env.RESEND_API_KEY);
      const res = await resend.emails.send({
        from: config.emailFrom(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      });
      if (res.error) {
        status = "failed";
        error = res.error.message;
      } else {
        status = "sent";
        providerId = res.data?.id ?? null;
      }
    }

    await db.messageLog.create({
      data: {
        dealId: input.dealId ?? null,
        bookingId: input.bookingId ?? null,
        channel: "email",
        template: input.template,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        status,
        providerId,
        error,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (err) {
    // Unique violation on dedupeKey means another request already sent it.
    if ((err as { code?: string }).code === "P2002") return;
    console.error(`[email] failed to send ${input.template} to ${input.to}`, err);
  }
}
