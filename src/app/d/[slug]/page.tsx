import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { TierLadder, TierProgress } from "@/components/tier-ladder";
import { Card, Icon, Notice } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDeadline, formatServiceDate } from "@/lib/dates";
import { formatCents } from "@/lib/domain/money";
import { countBookings, fillCopy, loadDealBySlug, lockDealIfDue, viewDeal } from "@/lib/services/deals";
import { AttributionTracker } from "./attribution";
import { BookingForm } from "./booking-form";
import { StickyCta } from "./sticky-cta";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const deal = await loadDealBySlug(slug);
  if (!deal) return {};
  return {
    title: `${deal.title} for ${deal.community.name}`,
    description: `${deal.serviceName} by ${deal.vendor.name} on ${formatServiceDate(deal.serviceDate)}. The price drops as neighbors book.`,
  };
}

export default async function DealPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  let deal = await loadDealBySlug(slug);
  if (!deal) notFound();
  if (await lockDealIfDue(deal.id)) deal = (await loadDealBySlug(slug))!;

  const admin = await isAdmin();
  if (deal.status === "draft" && !admin) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">This service day isn&apos;t open yet</h1>
        <p className="mt-2 text-muted">Check back soon, or watch for an email from your HOA.</p>
      </main>
    );
  }

  const counts = await countBookings(db, deal.id);
  const v = viewDeal(deal, counts);
  const included = deal.whatsIncluded.split("\n").map((s) => s.trim()).filter(Boolean);
  const src = sp.src ?? null;
  const ref = sp.ref ?? null;

  return (
    <>
      <AttributionTracker slug={slug} src={src} refCode={ref} />
      <PublicHeader community={deal.community.name} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6">
        {deal.status === "draft" ? (
          <Notice tone="warn" className="mb-4" title="Admin preview">
            This deal is a draft. Residents can&apos;t see it until you open it.
          </Notice>
        ) : null}
        {sp.checkout === "cancelled" ? (
          <Notice tone="info" className="mb-4" title="No card saved yet">
            You left the card page before finishing. Your spot is held for a few minutes. Submit the form again to pick up where you left off.
          </Notice>
        ) : null}

        {/* Hero */}
        <section className="pt-4 pb-6 sm:pt-8">
          <p className="text-sm font-semibold tracking-wide text-sage-600 uppercase">Neighborhood service day</p>
          <h1 className="mt-2 text-4xl leading-[1.05] font-extrabold text-pine-900 sm:text-5xl">{deal.title}</h1>
          <p className="mt-3 text-lg text-muted">
            {deal.serviceName} for {deal.community.name} homes by <span className="font-semibold text-ink">{deal.vendor.name}</span>, a vetted local pro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-ink ring-1 ring-line">
              <Icon name="calendar" className="size-4 text-pine-600" /> {formatServiceDate(deal.serviceDate)}
            </span>
            {deal.arrivalWindow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-ink ring-1 ring-line">
                <Icon name="clock" className="size-4 text-pine-600" /> {deal.arrivalWindow}
              </span>
            ) : null}
            {deal.backupDate ? <span className="inline-flex items-center rounded-full px-3 py-1.5 text-muted ring-1 ring-line">Rain date {formatServiceDate(deal.backupDate, "short")}</span> : null}
          </div>
        </section>

        {/* Price */}
        <Card id="price" className="overflow-hidden shadow-[0_1px_2px_rgba(27,36,32,0.04),0_8px_24px_-12px_rgba(31,77,58,0.18)]">
          <div className="bg-pine-800 px-5 pt-5 pb-6 text-white sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-sage-300">{v.locked ? "Final group price" : "Group price today"}</p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="font-display text-5xl font-extrabold tracking-tight">{formatCents(v.priceCents)}</span>
                  <span className="text-lg text-sage-400 line-through decoration-1">{formatCents(deal.normalPriceCents)}</span>
                </p>
                <p className="mt-1 text-sm text-sage-200">per home · everyone pays the same final price</p>
              </div>
              {v.savingsCents > 0 ? (
                <span className="shrink-0 rounded-full bg-sage-200 px-3 py-1 text-sm font-bold text-pine-900">Save {formatCents(v.savingsCents)}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <TierProgress tiers={deal.tiers} confirmed={v.confirmed} currentTierMinHomes={v.currentTierMinHomes} next={v.next} locked={v.locked} />
            <TierLadder tiers={deal.tiers} confirmed={v.confirmed} currentTierMinHomes={v.currentTierMinHomes} next={v.next} locked={v.locked} compact />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-sage-50 px-3 py-2.5">
                <p className="text-muted">Signups close</p>
                <p className="font-semibold">{formatDeadline(deal.signupDeadline)}</p>
              </div>
              <div className="rounded-xl bg-sage-50 px-3 py-2.5">
                <p className="text-muted">Spots left</p>
                <p className="font-semibold">{v.window === "open" ? (v.isFull ? "Full, waitlist open" : `${v.spotsLeft} of ${deal.capacity}`) : "Closed"}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Reserve fund */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sage-200 bg-sage-100 px-4 py-3.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white text-pine-700">
            <Icon name="leaf" className="size-4.5" />
          </span>
          <p className="text-[15px] leading-relaxed text-pine-900">{fillCopy(deal.reserveFundLine, deal)}</p>
        </div>

        {/* How it works */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon: "card" as const, t: "Book and save a card", d: "Takes a minute. You won't be charged today." },
              { icon: "users" as const, t: "Neighbors join, the price drops", d: "Everyone pays the final price, even if you booked first." },
              { icon: "check" as const, t: "Pay after the job", d: "We charge your card only once the work is done." },
            ].map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-pine-100 text-pine-700">
                    <Icon name={s.icon} className="size-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
                </div>
                <p className="mt-2.5 font-semibold">{s.t}</p>
                <p className="mt-0.5 text-sm text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Details */}
        {deal.description || included.length ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold">What you get</h2>
            {deal.description ? <p className="mt-2 text-[17px] leading-relaxed text-muted">{deal.description}</p> : null}
            {included.length ? (
              <ul className="mt-4 space-y-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-pine-700 text-white">
                      <Icon name="check" className="size-3" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
              <Icon name="shield" className="mt-0.5 size-6 shrink-0 text-pine-700" />
              <div>
                <p className="font-semibold">Satisfaction guarantee</p>
                <p className="text-sm text-muted">{fillCopy(deal.guaranteeLine, deal)}</p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Book */}
        <section id="book" className="mt-10 scroll-mt-4">
          <Card className="p-5 sm:p-6">
            {v.window === "open" ? (
              <>
                <h2 className="text-2xl font-bold">{v.isFull ? "Join the waitlist" : "Book your home"}</h2>
                <p className="mt-1 mb-5 text-muted">
                  For {deal.community.name} homes only. We check your address against the community list.
                </p>
                <BookingForm
                  slug={slug}
                  communityName={deal.community.name}
                  vendorName={deal.vendor.name}
                  priceCents={v.priceCents}
                  addOns={deal.addOns.map((a) => ({ id: a.id, name: a.name, description: a.description, priceCents: a.priceCents }))}
                  src={src}
                  refCode={ref}
                  full={v.isFull}
                />
              </>
            ) : (
              <div className="py-2 text-center">
                <h2 className="text-2xl font-bold">Signups are closed</h2>
                <p className="mt-2 text-muted">
                  {v.confirmed} {deal.community.name} homes booked at {formatCents(v.priceCents)}. Watch for the next service day from your HOA.
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Questions</h2>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {[
              ["When is my card charged?", `Only after ${deal.vendor.name} finishes the job. You'll get a receipt by email.`],
              ["What if more neighbors book after me?", "Your price drops too. Everyone pays the final group price, which locks when signups close."],
              ["What if it rains?", deal.backupDate ? `We'll move to the backup date, ${formatServiceDate(deal.backupDate)}, and email everyone.` : "We'll pick a new date with the crew and email everyone."],
              ["Do I need to be home?", "No. Just unlock side gates and keep pets inside. Leave the crew a note when you book."],
              ["Can I cancel?", fillCopy(deal.cancellationPolicy, deal)],
              ["Who is Pavilion?", `Pavilion partners with HOA communities to bring residents vetted local service companies at group prices. ${deal.vendor.name} does the work; Pavilion handles booking and payment.`],
            ].map(([q, a]) => (
              <details key={q} className="group px-4 py-3.5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {q}
                  <span className="text-xl leading-none text-sage-500 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter termsHref={`/d/${slug}/terms`} />
      {v.window === "open" ? <StickyCta label={v.isFull ? "Join the waitlist" : "Book your home"} sub={formatCents(v.priceCents)} /> : null}
    </>
  );
}
