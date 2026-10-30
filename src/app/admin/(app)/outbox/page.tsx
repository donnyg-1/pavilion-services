import { Notice } from "@/components/ui";
import { config } from "@/lib/config";
import { MessageTable } from "./message-table";

export const metadata = { title: "Outbox" };

export default function OutboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold">Outbox</h1>
        <p className="text-muted">Every email the app has sent or would have sent.</p>
      </div>
      {config.emailMode() === "log" ? (
        <Notice tone="warn" title="Emails aren't being delivered">
          No <code>RESEND_API_KEY</code> is set, so emails are only saved here. Add the key to send them for real.
        </Notice>
      ) : null}
      <MessageTable where={{}} />
    </div>
  );
}
