import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Badge, Card, Input, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { SOURCE_LABELS } from "@/lib/services/admin";
import { emailWaitlist, resolveReview } from "../../../actions";

export async function WaitlistTab({ dealId }: { dealId: string }) {
  const entries = await db.waitlistEntry.findMany({ where: { dealId }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">When a booked home cancels while the deal is full, everyone here is emailed automatically. First to book gets the spot.</p>
        <div className="flex gap-2">
          <a href={`/admin/deals/${dealId}/export/waitlist`} className={buttonClass("secondary", "sm")}>
            Export CSV
          </a>
          {entries.length ? (
            <ActionForm action={emailWaitlist.bind(null, dealId)} confirm={`Email all ${entries.length} people on the waitlist that a spot is open?`} inline>
              <SubmitButton variant="secondary">Email everyone now</SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-sage-50 text-left text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Contact</th>
              <th className="px-3 py-2.5 font-semibold">Address</th>
              <th className="px-3 py-2.5 font-semibold">Source</th>
              <th className="px-3 py-2.5 font-semibold">Joined</th>
              <th className="px-3 py-2.5 font-semibold">Last notified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted">Nobody on the waitlist.</td>
              </tr>
            ) : null}
            {entries.map((e, i) => (
              <tr key={e.id}>
                <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                <td className="px-3 py-2.5 font-semibold">{e.name}</td>
                <td className="px-3 py-2.5">
                  {e.email}
                  <span className="block text-muted">{e.phone}</span>
                </td>
                <td className="px-3 py-2.5">{e.address}</td>
                <td className="px-3 py-2.5">{SOURCE_LABELS[e.source]}</td>
                <td className="px-3 py-2.5 text-muted">{formatDateTime(e.createdAt)}</td>
                <td className="px-3 py-2.5 text-muted">{e.notifiedAt ? formatDateTime(e.notifiedAt) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export async function ReviewsTab({ dealId }: { dealId: string }) {
  const reviews = await db.addressReview.findMany({ where: { dealId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="space-y-4">
      <p className="text-muted">Residents whose address didn&apos;t match the community list. Approving adds the address to the list and emails them a link to book.</p>
      {reviews.length === 0 ? <Card className="p-10 text-center text-muted">No review requests.</Card> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {reviews.map((r) => (
          <Card key={r.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.rawAddress}</p>
                <p className="text-sm text-muted">
                  {r.name} · {r.email} · {r.phone}
                </p>
                <p className="text-xs text-muted">{formatDateTime(r.createdAt)}</p>
              </div>
              <Badge tone={r.status === "open" ? "honey" : r.status === "approved" ? "green" : "neutral"}>{r.status}</Badge>
            </div>
            {r.status === "open" ? (
              <div className="space-y-2">
                <ActionForm action={resolveReview.bind(null, r.id, dealId, true)} inline>
                  <div className="flex gap-2">
                    <Input name="address" defaultValue={r.rawAddress} className="h-9 py-1.5 text-sm" aria-label="Address to add" />
                    <SubmitButton pendingText="Approving…">Approve</SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm action={resolveReview.bind(null, r.id, dealId, false)} confirm="Reject and email the resident?" inline>
                  <SubmitButton variant="ghost" className="px-2 text-muted">
                    Not in the community, reject
                  </SubmitButton>
                </ActionForm>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
