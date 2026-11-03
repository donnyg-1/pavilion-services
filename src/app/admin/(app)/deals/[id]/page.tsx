import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, cx } from "@/components/ui";
import { db } from "@/lib/db";
import { formatServiceDate } from "@/lib/dates";
import { lockDealIfDue } from "@/lib/services/deals";
import { readFlash } from "@/lib/flash";
import { Flash } from "@/components/flash";
import { dealStats } from "@/lib/services/admin";
import { statusBadge } from "../../badges";
import { BookingsTab } from "./bookings-tab";
import { EmailsTab } from "./emails-tab";
import { LedgerTab } from "./ledger-tab";
import { OverviewTab } from "./overview-tab";
import { ReviewsTab, WaitlistTab } from "./lists-tab";

export const metadata = { title: "Deal" };

const TABS = [
  ["overview", "Overview"],
  ["bookings", "Bookings"],
  ["waitlist", "Waitlist"],
  ["reviews", "Address reviews"],
  ["ledger", "Ledger"],
  ["emails", "Emails"],
] as const;

export default async function DealAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; status?: string }> }) {
  const { id } = await params;
  const { tab = "overview", status } = await searchParams;
  if (!(await db.deal.findUnique({ where: { id }, select: { id: true } }))) notFound();
  await lockDealIfDue(id);
  const stats = await dealStats(id);
  const { deal, view } = stats;

  const flash = await readFlash();
  const counts: Record<string, number | undefined> = { waitlist: stats.waitlist, reviews: stats.openReviews };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-navy-700">← Deals</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold">{deal.title}</h1>
              {statusBadge(deal.status, view.window)}
            </div>
            <p className="text-muted">
              {deal.community.name} · {deal.vendor.name} · {formatServiceDate(deal.serviceDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href={`/d/${deal.slug}`} variant="secondary" target="_blank">
              View page
            </ButtonLink>
            <ButtonLink href={`/admin/deals/${id}/edit`}>Edit deal</ButtonLink>
          </div>
        </div>
      </div>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/deals/${id}?tab=${key}`}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap", tab === key ? "border-navy-700 text-navy-800" : "border-transparent text-muted hover:text-ink")}
          >
            {label}
            {counts[key] ? <span className="ml-1.5 rounded-full bg-honey-50 px-1.5 text-xs text-[#8a6418]">{counts[key]}</span> : null}
          </Link>
        ))}
      </nav>

      {flash ? <Flash ok={flash.ok} message={flash.message} /> : null}

      {tab === "bookings" ? <BookingsTab dealId={id} status={status} /> : null}
      {tab === "waitlist" ? <WaitlistTab dealId={id} /> : null}
      {tab === "reviews" ? <ReviewsTab dealId={id} /> : null}
      {tab === "ledger" ? <LedgerTab dealId={id} /> : null}
      {tab === "emails" ? <EmailsTab dealId={id} /> : null}
      {tab === "overview" || !TABS.some(([k]) => k === tab) ? <OverviewTab stats={stats} /> : null}
    </div>
  );
}
