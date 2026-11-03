import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { ButtonLink, Card, Icon } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDeadline, formatServiceDate } from "@/lib/dates";
import { formatCents } from "@/lib/domain/money";
import { countBookings, dealInclude, lockDealIfDue, viewDeal } from "@/lib/services/deals";
import { runDailyNow } from "../actions";
import { statusBadge } from "./badges";

export const metadata = { title: "Deals" };

export default async function AdminHome() {
  const ids = await db.deal.findMany({ where: { status: { in: ["open"] }, lockedAt: null }, select: { id: true } });
  for (const d of ids) await lockDealIfDue(d.id);

  const deals = await db.deal.findMany({ include: dealInclude, orderBy: [{ status: "asc" }, { serviceDate: "asc" }] });
  const rows = await Promise.all(deals.map(async (d) => ({ deal: d, v: viewDeal(d, await countBookings(db, d.id)) })));
  const [communities, vendors] = await Promise.all([db.community.count(), db.vendor.count()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Deals</h1>
          <p className="text-muted">Neighborhood service days, one community and one vendor each.</p>
        </div>
        <div className="flex items-start gap-2">
          <ActionForm action={runDailyNow} className="text-right">
            <SubmitButton variant="secondary" size="md" pendingText="Running…">
              Run daily jobs
            </SubmitButton>
          </ActionForm>
          <ButtonLink href="/admin/deals/new" size="md">
            New deal
          </ButtonLink>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <h2 className="text-xl font-bold">Set up your first service day</h2>
          <ol className="mt-3 space-y-2 text-[15px]">
            <li className="flex gap-2">
              <Icon name={communities ? "check" : "home"} className="size-5 text-navy-700" />
              <Link href="/admin/communities" className="font-semibold text-navy-700">Add a community and upload its address list</Link>
            </li>
            <li className="flex gap-2">
              <Icon name={vendors ? "check" : "truck"} className="size-5 text-navy-700" />
              <Link href="/admin/vendors" className="font-semibold text-navy-700">Add the vendor</Link>
            </li>
            <li className="flex gap-2">
              <Icon name="calendar" className="size-5 text-navy-700" />
              <Link href="/admin/deals/new" className="font-semibold text-navy-700">Create the deal</Link>
            </li>
          </ol>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ deal, v }) => (
            <Link key={deal.id} href={`/admin/deals/${deal.id}`} className="group">
              <Card className="h-full p-5 transition group-hover:border-stone-300 group-hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">{deal.community.name}</p>
                    <h2 className="text-xl font-bold group-hover:text-navy-700">{deal.title}</h2>
                    <p className="text-sm text-muted">
                      {deal.vendor.name} · {formatServiceDate(deal.serviceDate, "short")}
                    </p>
                  </div>
                  {statusBadge(deal.status, v.window)}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted">Booked</p>
                    <p className="font-display text-lg font-bold">
                      {v.confirmed}
                      <span className="text-sm font-normal text-muted">/{deal.capacity}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">{v.locked ? "Final price" : "Price now"}</p>
                    <p className="font-display text-lg font-bold">{formatCents(v.priceCents)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Signups close</p>
                    <p className="font-semibold">{formatDeadline(deal.signupDeadline)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
