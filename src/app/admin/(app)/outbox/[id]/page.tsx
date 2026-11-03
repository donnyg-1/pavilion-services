import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Email" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const msg = await db.messageLog.findUnique({ where: { id } });
  if (!msg) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={msg.dealId ? `/admin/deals/${msg.dealId}?tab=emails` : "/admin/outbox"} className="text-sm font-semibold text-navy-700">← Back</Link>
      <Card className="space-y-1 p-4 text-sm">
        <p className="text-lg font-bold">{msg.subject}</p>
        <p><span className="text-muted">To:</span> {msg.to}</p>
        <p><span className="text-muted">When:</span> {formatDateTime(msg.createdAt)} · <Badge tone={msg.status === "sent" ? "green" : msg.status === "failed" ? "red" : "honey"}>{msg.status}</Badge></p>
        {msg.error ? <p className="text-danger">{msg.error}</p> : null}
      </Card>
      {msg.channel === "sms" ? (
        <Card className="p-4">
          <p className="mb-2 text-sm text-muted">Text message · {msg.text.length} characters</p>
          <p className="max-w-sm rounded-2xl rounded-bl-sm bg-stone-100 px-4 py-3 text-[15px] whitespace-pre-line">{msg.text}</p>
        </Card>
      ) : (
      <iframe title="Email preview" srcDoc={msg.html.replace("<head>", '<head><base target="_blank">')} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[760px] w-full rounded-2xl border border-line bg-white" />
      )}
    </div>
  );
}
