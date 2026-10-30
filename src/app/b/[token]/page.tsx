import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { TierProgress } from "@/components/tier-ladder";
import { ButtonLink, Card, Icon, Notice, buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { formatDeadline, formatServiceDate } from "@/lib/dates";
import { residentCanCancel } from "@/lib/domain/capacity";
import { formatCents } from "@/lib/domain/money";
import { syncSetupSession } from "@/lib/services/booking";
import { syncPaymentSession } from "@/lib/services/charging";
import { bookingAddress, bookingInclude, countBookings, dealInclude, fillCopy, lockDealIfDue, viewDeal } from "@/lib/services/deals";
import { CancelBooking } from "./cancel";
import { ShareBox } from "./share";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function BookingPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;

  // Stripe redirects here after the card is saved / payment made. Sync now so the page is
  // right even if the webhook hasn't arrived yet (or isn't forwarded in local dev).
  if (sp.session_id) await syncSetupSession(sp.session_id).catch((e) => console.error(e));
  if (sp.paid_session) await syncPaymentSession(sp.paid_session).catch((e) => console.error(e));

  const found = await db.booking.findUnique({ where: { publicToken: token }, include: { ...bookingInclude, charges: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!found) notFound();
  await lockDealIfDue(found.dealId);
  const booking = found;
  const deal = await db.deal.findUniqueOrThrow({ where: { id: booking.dealId }, include: dealInclude });
  const v = viewDeal(deal, await countBookings(db, deal.id));
  const addOnTotal = booking.addOns.reduce((s, a) => s + a.priceCents, 0);
  const shareUrl = url(`/d/${deal.slug}?ref=${booking.referralCode}`);
  const canCancel = residentCanCancel(booking.status, deal.signupDeadline, new Date());
  const charge = booking.charges[0];

  const header = (() => {
    switch (booking.status) {
      case "pending_setup":
        return { icon: "clock" as const, tone: "bg-honey-50 text-[#8a6418]", title: "Almost there", sub: "We're waiting to hear back from the card page. This usually takes a few seconds." };
      case "booked":
        return { icon: "check" as const, tone: "bg-pine-100 text-pine-700", title: sp.session_id || sp.new ? "You're booked!" : "You're booked", sub: `${deal.vendor.name} will be at your home ${formatServiceDate(deal.serviceDate)}. Your card is saved, not charged.` };
      case "completed":
        return { icon: "clock" as const, tone: "bg-sage-100 text-pine-700", title: "Job complete", sub: "We're processing your payment now." };
      case "charged":
        return { icon: "check" as const, tone: "bg-pine-100 text-pine-700", title: "All done. Thank you!", sub: `Paid ${formatCents(charge?.amountCents ?? 0)}. Your receipt is in your email.` };
      case "failed":
        return { icon: "card" as const, tone: "bg-honey-50 text-[#8a6418]", title: "Payment needed", sub: "The job is done, but your card didn't go through. You can pay securely below." };
      case "refunded":
        return { icon: "check" as const, tone: "bg-sage-100 text-pine-700", title: "Refunded", sub: "We refunded this booking. It usually shows up in 5–10 business days." };
      case "cancelled":
        return { icon: "x" as const, tone: "bg-sage-100 text-muted", title: "Booking cancelled", sub: "Your card won't be charged." };
      case "expired":
        return { icon: "clock" as const, tone: "bg-sage-100 text-muted", title: "This booking wasn't finished", sub: "The card wasn't saved in time, so the spot was released." };
    }
  })();

  return (
    <>
      {booking.status === "pending_setup" ? <meta httpEquiv="refresh" content="3" /> : null}
      <PublicHeader community={deal.community.name} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-6 sm:px-6">
        <section className="animate-rise pt-4 text-center sm:pt-8">
          <div className={`mx-auto grid size-14 place-items-center rounded-full ${header.tone}`}>
            <Icon name={header.icon} className="size-7" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-pine-900 sm:text-4xl">{header.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">{header.sub}</p>
        </section>

        {booking.status === "failed" ? (
          <Card className="p-5 text-center">
            <p className="text-muted">Amount due</p>
            <p className="font-display text-4xl font-extrabold">{formatCents(charge?.amountCents ?? 0)}</p>
            <a href={`/b/${token}/pay`} className={buttonClass("primary", "lg", "mt-4 w-full")}>
              Pay securely
            </a>
          </Card>
        ) : null}

        {(booking.status === "cancelled" || booking.status === "expired") && v.window === "open" ? (
          <div className="text-center">
            <ButtonLink href={`/d/${deal.slug}`} size="lg">
              Book again
            </ButtonLink>
          </div>
        ) : null}

        {booking.status === "booked" ? <ShareBox url={shareUrl} title={deal.title} communityName={deal.community.name} priceCents={v.priceCents} next={v.next} /> : null}

        <Card className="divide-y divide-line">
          <div className="p-5">
            <p className="text-sm font-semibold tracking-wide text-sage-600 uppercase">{deal.title}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
              <dt className="text-muted">Date</dt>
              <dd className="font-semibold">
                {formatServiceDate(deal.serviceDate)}
                {deal.arrivalWindow ? <span className="font-normal text-muted"> · {deal.arrivalWindow}</span> : null}
                {deal.backupDate ? <span className="block text-sm font-normal text-muted">Rain date {formatServiceDate(deal.backupDate)}</span> : null}
              </dd>
              <dt className="text-muted">Address</dt>
              <dd>{bookingAddress(booking)}</dd>
              <dt className="text-muted">Pro</dt>
              <dd>{deal.vendor.name}</dd>
              {booking.addOns.map((a) => (
                <div key={a.addOnId} className="contents">
                  <dt className="text-muted">Add-on</dt>
                  <dd>
                    {a.addOn.name} <span className="text-muted">+{formatCents(a.priceCents)}</span>
                  </dd>
                </div>
              ))}
              {booking.notes ? (
                <>
                  <dt className="text-muted">Notes</dt>
                  <dd className="whitespace-pre-line">{booking.notes}</dd>
                </>
              ) : null}
              {booking.cardLast4 ? (
                <>
                  <dt className="text-muted">Card</dt>
                  <dd>
                    <span className="capitalize">{booking.cardBrand}</span> ending {booking.cardLast4}
                  </dd>
                </>
              ) : null}
            </dl>
          </div>

          {["booked", "pending_setup"].includes(booking.status) ? (
            <div className="space-y-3 p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-muted">{v.locked ? "Final price" : "Price right now"}</span>
                <span className="font-display text-2xl font-bold">
                  {formatCents(v.priceCents + addOnTotal)}
                  {addOnTotal ? <span className="ml-1 text-sm font-normal text-muted">with add-ons</span> : null}
                </span>
              </div>
              <TierProgress tiers={deal.tiers} confirmed={v.confirmed} currentTierMinHomes={v.currentTierMinHomes} next={v.next} locked={v.locked} />
              <p className="text-sm text-muted">
                {v.locked ? "Signups are closed and your price is locked." : `The price can only go down. It locks when signups close ${formatDeadline(deal.signupDeadline)}.`} You&apos;re charged after the job is done.
              </p>
            </div>
          ) : null}
        </Card>

        {booking.status === "booked" ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a href={`/b/${token}/calendar.ics`} className={buttonClass("secondary", "md")}>
              <Icon name="calendar" className="size-4.5" /> Add to calendar
            </a>
          </div>
        ) : null}

        {canCancel ? (
          <CancelBooking token={token} deadline={formatDeadline(deal.signupDeadline)} />
        ) : booking.status === "booked" ? (
          <Notice tone="info">Signups have closed, so this booking can&apos;t be cancelled online. Reply to your confirmation email if something comes up.</Notice>
        ) : null}

        <p className="px-2 text-center text-sm text-muted">{fillCopy(deal.reserveFundLine, deal)}</p>
        <p className="text-center text-sm">
          <Link href={`/d/${deal.slug}/terms`} className="font-semibold text-pine-700">
            Booking terms
          </Link>
        </p>
      </main>
      <PublicFooter />
    </>
  );
}
