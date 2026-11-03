import { ActionForm, CopyField, SubmitButton } from "@/components/admin-ui";
import { TierLadder, TierProgress } from "@/components/tier-ladder";
import { Card, Input, Notice, Stat } from "@/components/ui";
import { url } from "@/lib/config";
import { formatDateTime, formatDeadline, formatServiceDate, isoDate } from "@/lib/dates";
import { bpsToPercent, formatCents } from "@/lib/domain/money";
import type { dealStats } from "@/lib/services/admin";
import { closeSignups, reschedule, setDealStatus } from "../../../actions";

type Stats = Awaited<ReturnType<typeof dealStats>>;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function OverviewTab({ stats }: { stats: Stats }) {
  const { deal, view, money } = stats;
  const base = url(`/d/${deal.slug}`);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Homes booked" value={`${view.confirmed} / ${deal.capacity}`} sub={view.isFull ? "Full, waitlist on" : `${view.spotsLeft} spots left`} />
        <Stat label="Of the community" value={pct(stats.percentOfCommunity)} sub={`${stats.homes} homes on the list`} />
        <Stat label={view.locked ? "Final price" : "Price now"} value={formatCents(view.priceCents)} sub={view.next ? `${view.next.homesNeeded} more → ${formatCents(view.next.priceCents)}` : view.locked ? "Locked" : "Lowest tier"} />
        <Stat label="Avg rating" value={stats.ratings.average ? stats.ratings.average.toFixed(1) : "–"} sub={`${stats.ratings.count} ${stats.ratings.count === 1 ? "rating" : "ratings"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-bold">Where bookings come from</h2>
            <p className="text-sm text-muted">
              {pct(stats.referralShare)} of bookings came from neighbor referrals.
              {deal.referralCreditCents > 0 ? ` Referrers get ${formatCents(deal.referralCreditCents)} off per neighbor, up to ${formatCents(deal.referralCreditCapCents)}.` : ""} Visitors are unique browsers.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2 font-semibold">Source</th>
                    <th className="py-2 text-right font-semibold">Visitors</th>
                    <th className="py-2 text-right font-semibold">Booked</th>
                    <th className="py-2 text-right font-semibold">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.sources.map((s) => (
                    <tr key={s.source}>
                      <td className="py-2">{s.label}</td>
                      <td className="py-2 text-right tabular-nums">{s.visitors}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{s.booked}</td>
                      <td className="py-2 text-right tabular-nums text-muted">{s.conversion == null ? "–" : pct(s.conversion)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{stats.totalVisitors}</td>
                    <td className="py-2 text-right tabular-nums">{view.confirmed}</td>
                    <td className="py-2 text-right tabular-nums">{stats.totalVisitors ? pct(view.confirmed / stats.totalVisitors) : "–"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-2 p-5">
            <h2 className="text-lg font-bold">Links to share</h2>
            <p className="text-sm text-muted">Each link records where a booking came from. Residents&apos; own share links count as neighbor referrals.</p>
            <CopyField label="Manager" value={`${base}?src=manager`} />
            <CopyField label="Board" value={`${base}?src=board`} />
            <CopyField label="Facebook" value={`${base}?src=facebook`} />
            <CopyField label="Flyer" value={`${base}?src=flyer`} />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">Money</h2>
            <p className="text-sm text-muted">
              {stats.chargedCount} {stats.chargedCount === 1 ? "job" : "jobs"} charged · commission {bpsToPercent(deal.commissionBps)}, manager {bpsToPercent(deal.managerShareBps)}, HOA {bpsToPercent(deal.hoaShareBps)} of {deal.shareBasis === "price" ? "final price" : "commission"}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {[
                ["Collected (net of refunds)", money.finalPriceCents],
                ["Pavilion commission", money.commissionCents],
                ["Pavilion keeps", money.pavilionNetCents],
                ["Manager share", money.managerShareCents],
                ["HOA reserve share", money.hoaShareCents],
                ["Card processing", money.processingFeeCents],
                ["Vendor payout owed", money.vendorPayoutCents],
                ["Referral credits given", stats.referralCreditsCents],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-display text-lg font-bold">{formatCents(v as number, { showZeroCents: true })}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-bold">Price</h2>
            <TierProgress tiers={deal.tiers} confirmed={view.confirmed} currentTierMinHomes={view.currentTierMinHomes} next={view.next} locked={view.locked} />
            <TierLadder tiers={deal.tiers} confirmed={view.confirmed} currentTierMinHomes={view.currentTierMinHomes} next={view.next} locked={view.locked} compact />
            <p className="text-sm text-muted">
              Normal {formatCents(deal.normalPriceCents)} · peak {deal.peakBookedCount} homes ·{" "}
              {view.locked && deal.lockedAt ? `locked ${formatDateTime(deal.lockedAt)}` : `locks ${formatDeadline(deal.signupDeadline)}`}
            </p>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-bold">Signups</h2>
            {deal.status === "draft" ? (
              <>
                <p className="text-sm text-muted">Draft. Only you can see the page.</p>
                <ActionForm action={setDealStatus.bind(null, deal.id, "open")}>
                  <SubmitButton>Open signups</SubmitButton>
                </ActionForm>
              </>
            ) : view.window === "open" ? (
              <>
                <p className="text-sm text-muted">Open until {formatDeadline(deal.signupDeadline)}. Close early to lock the price and start charging.</p>
                <ActionForm action={closeSignups.bind(null, deal.id)} confirm="Close signups now and lock the price? Booked residents get their final price by email.">
                  <SubmitButton variant="secondary">Close signups now</SubmitButton>
                </ActionForm>
              </>
            ) : deal.status === "open" ? (
              <>
                <p className="text-sm text-muted">Signups closed. Mark homes complete from the Bookings tab to charge them.</p>
                <ActionForm action={setDealStatus.bind(null, deal.id, "completed")} confirm="Mark this service day completed?">
                  <SubmitButton variant="secondary">Mark service day completed</SubmitButton>
                </ActionForm>
              </>
            ) : (
              <p className="text-sm text-muted">This deal is {deal.status}.</p>
            )}
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-lg font-bold">Weather reschedule</h2>
            <p className="text-sm text-muted">
              Moves the service day and emails every booked home at once.
              {deal.rescheduledAt ? ` Last moved ${formatDateTime(deal.rescheduledAt)}.` : ""}
            </p>
            <ActionForm action={reschedule.bind(null, deal.id)} confirm="Move the service day and email every booked home?" className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input type="date" name="date" defaultValue={deal.backupDate ? isoDate(deal.backupDate) : ""} required aria-label="New date" />
                <SubmitButton variant="secondary" size="md">
                  Move &amp; notify
                </SubmitButton>
              </div>
              <Input name="note" placeholder="Optional note, e.g. Rain is forecast all day Saturday." aria-label="Note" />
            </ActionForm>
            {deal.backupDate ? <p className="text-xs text-muted">Backup date on file: {formatServiceDate(deal.backupDate)}</p> : <Notice tone="warn">No backup date left. Pick any date.</Notice>}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">Ratings</h2>
            <div className="mt-3 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = stats.ratings.distribution[n - 1];
                const max = Math.max(1, ...stats.ratings.distribution);
                return (
                  <div key={n} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-muted">{n}</span>
                    <div className="h-2 flex-1 rounded-full bg-stone-100">
                      <div className="h-2 rounded-full bg-navy-600" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
