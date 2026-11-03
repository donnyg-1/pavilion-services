import { Notice } from "@/components/ui";
import { config } from "@/lib/config";
import { MessageTable } from "./message-table";

export const metadata = { title: "Outbox" };

export default function OutboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold">Outbox</h1>
        <p className="text-muted">Every email and text the app has sent or would have sent.</p>
      </div>
      {config.emailMode() === "log" ? (
        <Notice tone="warn" title="Emails aren't being delivered">
          No <code>RESEND_API_KEY</code> is set, so emails are only saved here. Add the key to send them for real.
        </Notice>
      ) : null}
      {config.smsMode() === "log" ? (
        <Notice tone="warn" title="Texts aren't being delivered">
          Twilio isn&apos;t set up, so texts are only saved here. Add the <code>TWILIO_</code> settings to send them for real.
        </Notice>
      ) : null}
      <MessageTable where={{}} />
    </div>
  );
}
