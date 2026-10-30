import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Badge, Card, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { sumLedger, type LedgerAmounts } from "@/lib/domain/ledger";
import { formatCents } from "@/lib/domain/money";
import { markPayoutsPaid } from "../../../actions";

const m = (c: number) => formatCents(c, { showZeroCents: true });

export async function LedgerTab({ dealId }: { dealId: string }) {
  const rows = await db.ledgerEntry.findMany({ where: { dealId }, include: { booking: { include: { communityAddress: true, resident: true } } }, orderBy: { createdAt: "asc" } });
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { vendor: true, community: { include: { managementCompany: true } } } });
  const total = sumLedger(rows as LedgerAmounts[]);
  const owed = (field: "vendorPayoutStatus" | "managerPayoutStatus" | "hoaPayoutStatus", amount: keyof LedgerAmounts) =>
    rows.filter((r) => r[field] === "owed").reduce((s, r) => s + (r[amount] as number), 0);

  const payouts = [
    { party: "vendor" as const, label: deal.vendor.name, sub: "Vendor payout", owed: owed("vendorPayoutStatus", "vendorPayoutCents"), total: total.vendorPayoutCents },
    { party: "manager" as const, label: deal.community.managementCompany?.name ?? "Management company", sub: "Manager share", owed: owed("managerPayoutStatus", "managerShareCents"), total: total.managerShareCents },
    { party: "hoa" as const, label: `${deal.community.name} reserve fund`, sub: "HOA share", owed: owed("hoaPayoutStatus", "hoaShareCents"), total: total.hoaShareCents },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">One row per successful charge; refunds add negative rows. Final price is after any referral credit, so every share already reflects it. Pay out manually, then mark paid.</p>
        <a href={`/admin/deals/${dealId}/export/ledger`} className={buttonClass("secondary", "sm")}>
          Export ledger CSV
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {payouts.map((p) => (
          <Card key={p.party} className="p-4">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{p.sub}</p>
            <p className="font-semibold">{p.label}</p>
            <p className="mt-2 font-display text-2xl font-bold">{m(p.owed)}</p>
            <p className="text-sm text-muted">owed · {m(p.total)} total</p>
            {p.owed !== 0 ? (
              <ActionForm action={markPayoutsPaid.bind(null, dealId, p.party)} confirm={`Mark ${m(p.owed)} to ${p.label} as paid?`} className="mt-3" inline>
                <SubmitButton variant="secondary">Mark paid</SubmitButton>
              </ActionForm>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm tabular-nums">
          <thead className="border-b border-line bg-sage-50 text-left text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Date</th>
              <th className="px-3 py-2.5 font-semibold">Home</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 text-right font-semibold">Final price</th>
              <th className="px-3 py-2.5 text-right font-semibold">Commission</th>
              <th className="px-3 py-2.5 text-right font-semibold">Manager</th>
              <th className="px-3 py-2.5 text-right font-semibold">HOA</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pavilion keeps</th>
              <th className="px-3 py-2.5 text-right font-semibold">Processing</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vendor payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted">No charges yet.</td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className={r.type === "refund" ? "bg-danger-50/40" : undefined}>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-3 py-2.5">
                  {r.booking.communityAddress.raw}
                  <span className="block text-xs text-muted">{r.booking.resident.name}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={r.type === "refund" ? "red" : "green"}>{r.type}</Badge>
                  {r.feeIsEstimate ? <span className="ml-1 text-xs text-muted" title="Stripe fee estimated">est.</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {m(r.finalPriceCents)}
                  {r.referralCreditCents ? <span className="block text-xs text-muted">after {m(-r.referralCreditCents)} referral</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right">{m(r.commissionCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(r.managerShareCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(r.hoaShareCents)}</td>
                <td className="px-3 py-2.5 text-right">
                  {m(r.pavilionNetCents)}
                  {r.feeAbsorbedCents ? <span className="block text-xs text-muted">incl. {m(-r.feeAbsorbedCents)} fee</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right">{m(r.processingFeeCents)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{m(r.vendorPayoutCents)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length ? (
            <tfoot className="border-t-2 border-line font-semibold">
              <tr>
                <td className="px-3 py-2.5" colSpan={3}>Total</td>
                <td className="px-3 py-2.5 text-right">{m(total.finalPriceCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.commissionCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.managerShareCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.hoaShareCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.pavilionNetCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.processingFeeCents)}</td>
                <td className="px-3 py-2.5 text-right">{m(total.vendorPayoutCents)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </Card>
    </div>
  );
}
