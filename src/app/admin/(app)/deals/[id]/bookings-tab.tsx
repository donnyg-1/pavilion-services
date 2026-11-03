import Link from "next/link";
import { ActionForm, CopyField, SelectAll, SubmitButton } from "@/components/admin-ui";
import { Card, Input, Notice, cx, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { formatDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/domain/money";
import { routeSortKey } from "@/lib/domain/address";
import { SOURCE_LABELS } from "@/lib/services/admin";
import { bookingAddress, bookingInclude, REFERRAL_STATUSES } from "@/lib/services/deals";
import { referralCreditCents } from "@/lib/domain/pricing";
import { adminCancel, chargeBooking, chargeSelected, refund, retryBookingCharge, textOnTheWay } from "../../../actions";
import { bookingBadge } from "../../badges";

const FILTERS = ["all", "booked", "charged", "failed", "refunded", "cancelled", "pending_setup", "expired"] as const;
const FILTER_LABELS: Record<string, string> = { all: "All active", pending_setup: "Saving card", expired: "Abandoned" };

export async function BookingsTab({ dealId, status }: { dealId: string; status?: string }) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  const all = await db.booking.findMany({
    where: { dealId },
    include: { ...bookingInclude, charges: { orderBy: { createdAt: "desc" } }, rating: true, referredBy: { select: { resident: { select: { name: true } } } } },
  });
  const filter = (FILTERS as readonly string[]).includes(status ?? "") ? status! : "all";
  const active = all.filter((b) => !["cancelled", "expired"].includes(b.status));
  const shown = (filter === "all" ? active : all.filter((b) => b.status === filter)).sort((a, b) => {
    const [sa, na] = routeSortKey(a.communityAddress.normalized);
    const [sb, nb] = routeSortKey(b.communityAddress.normalized);
    return sa === sb ? na - nb : sa.localeCompare(sb);
  });
  const count = (f: string) => (f === "all" ? active.length : all.filter((b) => b.status === f).length);
  const bookedCount = all.filter((b) => b.status === "booked").length;
  const canCharge = deal.lockedPriceCents != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f === "all" || count(f) > 0).map((f) => (
            <Link
              key={f}
              href={`/admin/deals/${dealId}?tab=bookings${f === "all" ? "" : `&status=${f}`}`}
              className={cx("rounded-full px-3 py-1 text-sm font-semibold capitalize", filter === f ? "bg-navy-700 text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink")}
            >
              {FILTER_LABELS[f] ?? f} <span className="opacity-70">{count(f)}</span>
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <a href={`/admin/deals/${dealId}/export/route`} className={buttonClass("secondary", "sm")}>
            Route CSV for vendor
          </a>
          <a href={`/admin/deals/${dealId}/export/bookings`} className={buttonClass("secondary", "sm")}>
            All bookings CSV
          </a>
        </div>
      </div>

      {!canCharge && bookedCount > 0 ? (
        <Notice tone="info">Signups are still open, so the final price isn&apos;t locked yet. Close signups on the Overview tab before charging.</Notice>
      ) : null}

      {canCharge ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            {bookedCount > 0 ? (
              <>
                <span className="font-semibold">Service day done?</span> Select homes and charge them at {formatCents(deal.lockedPriceCents!)} (plus add-ons).
              </>
            ) : (
              <span className="text-muted">No booked homes left to charge.</span>
            )}
          </p>
          <ActionForm id="bulk-charge" action={chargeSelected.bind(null, dealId)} silent confirm="Charge every selected home's saved card now?" inline>
            {bookedCount > 0 ? <SubmitButton pendingText="Charging…">Complete &amp; charge selected</SubmitButton> : null}
          </ActionForm>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-stone-50 text-left text-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">{canCharge ? <SelectAll formId="bulk-charge" /> : null}</th>
              <th className="px-3 py-2.5 font-semibold">Home</th>
              <th className="px-3 py-2.5 font-semibold">Contact</th>
              <th className="px-3 py-2.5 font-semibold">Source</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted">
                  No bookings here yet.
                </td>
              </tr>
            ) : null}
            {shown.map((b) => {
              const charge = b.charges[0];
              const addOnTotal = b.addOns.reduce((s, a) => s + a.priceCents, 0);
              const referrals = all.filter((x) => x.referredById === b.id && (REFERRAL_STATUSES as readonly string[]).includes(x.status)).length;
              const creditPreview = deal.lockedPriceCents != null ? referralCreditCents({ referrals, perReferralCents: deal.referralCreditCents, capCents: deal.referralCreditCapCents, jobTotalCents: deal.lockedPriceCents + addOnTotal }) : 0;
              const amount = charge?.amountCents ?? (deal.lockedPriceCents != null ? deal.lockedPriceCents + addOnTotal - creditPreview : null);
              const credit = charge?.referralCreditCents ?? creditPreview;
              return (
                <tr key={b.id} className="align-top">
                  <td className="px-3 py-3">
                    {/* Joins the "bulk-charge" form above via the form attribute. */}
                    {canCharge && b.status === "booked" ? <input type="checkbox" name="bookingId" value={b.id} form="bulk-charge" className="size-4 accent-navy-700" aria-label={`Select ${b.communityAddress.raw}`} /> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{bookingAddress(b)}</p>
                    <p className="text-muted">{b.resident.name}</p>
                    {b.addOns.length ? <p className="text-xs text-navy-700">+ {b.addOns.map((a) => a.addOn.name).join(", ")}</p> : null}
                    {b.notes ? <p className="mt-0.5 max-w-xs text-xs text-muted italic">“{b.notes}”</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p>{b.resident.email}</p>
                    <p className="text-muted">{b.resident.phone}</p>
                    <p className={cx("text-xs", b.resident.smsOptIn ? "text-navy-700" : "text-muted")}>{b.resident.smsOptIn ? "Texts on" : "No texts"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{SOURCE_LABELS[b.source]}</p>
                    {b.referredBy ? <p className="text-xs text-muted">from {b.referredBy.resident.name}</p> : null}
                    {referrals ? <p className="text-xs font-semibold text-navy-700">Referred {referrals} {referrals === 1 ? "neighbor" : "neighbors"}</p> : null}
                    <p className="text-xs text-muted">{formatDateTime(b.bookedAt ?? b.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    {bookingBadge(b.status)}
                    {b.status === "failed" && charge?.failureCode ? <p className="mt-1 text-xs text-danger">{charge.failureCode.replace(/_/g, " ")}</p> : null}
                    {b.rating ? <p className="mt-1 text-xs text-muted">Rated {b.rating.score}/5</p> : null}
                    {b.cardLast4 ? <p className="mt-1 text-xs text-muted capitalize">{b.cardBrand} ••{b.cardLast4}</p> : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {amount != null ? formatCents(amount, { showZeroCents: true }) : <span className="text-muted">–</span>}
                    {credit ? <p className="text-xs text-navy-700">after −{formatCents(credit, { showZeroCents: true })} referral</p> : null}
                    {charge?.refundedCents ? <p className="text-xs text-muted">−{formatCents(charge.refundedCents, { showZeroCents: true })} refunded</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <RowActions booking={b} texts={b.resident.smsOptIn} dealId={dealId} canCharge={canCharge} remaining={charge ? charge.amountCents - charge.refundedCents : 0} payUrl={url(`/b/${b.publicToken}/pay`)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RowActions({ booking, texts, dealId, canCharge, remaining, payUrl }: { booking: { id: string; status: string; publicToken: string; onTheWayAt: Date | null }; texts: boolean; dealId: string; canCharge: boolean; remaining: number; payUrl: string }) {
  const s = booking.status;
  return (
    <div className="flex min-w-48 flex-col items-start gap-2">
      {s === "booked" && canCharge ? (
        <ActionForm action={chargeBooking.bind(null, booking.id, dealId)} silent confirm="Mark complete and charge this card now?" inline>
          <SubmitButton pendingText="Charging…">Complete &amp; charge</SubmitButton>
        </ActionForm>
      ) : null}
      {s === "booked" && texts ? (
        <ActionForm action={textOnTheWay.bind(null, booking.id, dealId)} silent inline>
          <SubmitButton variant="secondary" pendingText="Texting…">
            {booking.onTheWayAt ? "Text again: on the way" : "Text: crew on the way"}
          </SubmitButton>
          {booking.onTheWayAt ? <p className="mt-1 text-xs text-muted">Sent {formatDateTime(booking.onTheWayAt)}</p> : null}
        </ActionForm>
      ) : null}
      {s === "failed" ? (
        <>
          <ActionForm action={retryBookingCharge.bind(null, booking.id, dealId)} silent inline>
            <SubmitButton variant="secondary" pendingText="Retrying…">
              Retry card
            </SubmitButton>
          </ActionForm>
          <div className="w-64">
            <CopyField value={payUrl} />
          </div>
        </>
      ) : null}
      {s === "charged" && remaining > 0 ? (
        <ActionForm action={refund.bind(null, booking.id, dealId)} silent confirm="Issue this refund? It can't be undone." inline>
          <div className="flex items-center gap-1.5">
            <Input name="amount" placeholder={`Full (${formatCents(remaining)})`} inputMode="decimal" className="h-9 w-32 py-1.5 text-sm" aria-label="Refund amount" />
            <SubmitButton variant="secondary" pendingText="Refunding…">
              Refund
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}
      {["booked", "pending_setup", "failed"].includes(s) ? (
        <ActionForm action={adminCancel.bind(null, booking.id, dealId)} silent confirm="Cancel this booking? The resident is emailed." inline>
          <SubmitButton variant="ghost" pendingText="Cancelling…" className="h-7 px-2 text-muted">
            Cancel booking
          </SubmitButton>
        </ActionForm>
      ) : null}
      <Link href={`/b/${booking.publicToken}`} target="_blank" className="px-2 text-xs font-semibold text-navy-700">
        Resident view ↗
      </Link>
    </div>
  );
}
