import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

export async function MessageTable({ where }: { where: Prisma.MessageLogWhereInput }) {
  const messages = await db.messageLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, channel: true, to: true, subject: true, template: true, status: true, createdAt: true, error: true } });
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-line bg-sage-50 text-left text-muted">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Sent</th>
            <th className="px-3 py-2.5 font-semibold">To</th>
            <th className="px-3 py-2.5 font-semibold">Subject / text</th>
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {messages.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted">No messages yet.</td>
            </tr>
          ) : null}
          {messages.map((msg) => (
            <tr key={msg.id} className="hover:bg-sage-50">
              <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDateTime(msg.createdAt)}</td>
              <td className="px-3 py-2.5">{msg.to}</td>
              <td className="px-3 py-2.5">
                {msg.channel === "sms" ? <Badge tone="blue" className="mr-1.5">Text</Badge> : null}
                <Link href={`/admin/outbox/${msg.id}`} className="font-semibold text-pine-700 hover:underline">
                  {msg.subject}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-muted">{msg.template.replace(/_/g, " ")}</td>
              <td className="px-3 py-2.5">
                <Badge tone={msg.status === "sent" ? "green" : msg.status === "failed" ? "red" : "honey"} title={msg.error ?? undefined}>
                  {msg.status === "logged" ? "outbox only" : msg.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
