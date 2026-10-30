import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { formatDeadline } from "@/lib/dates";
import { bpsToPercent } from "@/lib/domain/money";
import { fillCopy, loadDealBySlug } from "@/lib/services/deals";

export const metadata: Metadata = { title: "Booking terms" };

function LegalFlag() {
  return <span className="ml-2 inline-block rounded bg-honey-50 px-1.5 py-0.5 align-middle font-sans text-[11px] font-bold tracking-wide text-[#8a6418] uppercase">[Needs legal review]</span>;
}

export default async function TermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deal = await loadDealBySlug(slug);
  if (!deal) notFound();

  const share = (bps: number) => (deal.shareBasis === "price" ? `${bpsToPercent(bps)} of the final price` : `${bpsToPercent(bps)} of Pavilion's commission`);
  const sections: [string, string[]][] = [
    [
      "Who does what",
      [
        `Pavilion is a booking platform. Pavilion does not perform the service. ${deal.vendor.name} ("the service company") is an independent business that performs the ${deal.serviceName.toLowerCase()} and is responsible for the work.`,
        `Pavilion collects payment on the service company's behalf and pays the service company after the job is complete.`,
      ],
    ],
    [
      "Pricing",
      [
        `The price per home drops as more homes in ${deal.community.name} book. The price can only go down. Every home pays the same final group price, which locks when signups close (${formatDeadline(deal.signupDeadline)}, Mountain Time). Cancellations after that don't change the price.`,
        `Optional add-ons are charged at the flat price shown when you book.`,
      ],
    ],
    [
      "How payment works",
      [
        `When you book, you save a card through our payment processor, Stripe. You are not charged at booking.`,
        `By saving your card, you authorize Pavilion to charge it the final group price plus any add-ons you chose after the service company marks your job complete. If the charge doesn't go through, we'll email you a secure link to pay.`,
      ],
    ],
    [
      "Where the money goes",
      [
        `Pavilion earns a commission of ${bpsToPercent(deal.commissionBps)} of the final price on each completed job.`,
        `Out of that commission, ${share(deal.hoaShareBps)} goes to ${deal.community.name}'s reserve fund.`,
        deal.community.managementCompanyId || deal.managerShareBps > 0
          ? `Your community's management company may receive ${share(deal.managerShareBps)} for sharing this offer with residents.`
          : `Your community's management company does not receive a share of this booking.`,
        `Card processing fees are paid by the service company out of its payment, not added to your price.`,
      ],
    ],
    ["Satisfaction guarantee", [`${fillCopy(deal.guaranteeLine, deal)} Contact us within 7 days of the service by replying to your receipt email. The service company will come back to fix the issue, or we will refund you.`]],
    [
      "Cancellations and weather",
      [
        fillCopy(deal.cancellationPolicy, deal),
        `You can cancel online from your confirmation email until signups close. If weather prevents the work, the service day moves to the backup date and we email everyone. If you can't make the new date, contact us.`,
      ],
    ],
    ["Your information", [`We use your name, email, phone and address only to book and complete this service, send updates about it, and take payment. We share your address and notes with the service company so they can do the job. We never show your name or address to other residents.`]],
  ];

  return (
    <>
      <PublicHeader community={deal.community.name} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href={`/d/${slug}`} className="text-sm font-semibold text-pine-700">
          ← Back to {deal.title}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold">Booking terms</h1>
        <p className="mt-2 rounded-xl border border-honey/40 bg-honey-50 px-4 py-3 text-sm text-[#5f4512]">
          <strong>[NEEDS LEGAL REVIEW]</strong> This is placeholder text for the pilot and has not been reviewed by a lawyer.
        </p>
        <div className="mt-6 space-y-8">
          {sections.map(([title, paras]) => (
            <section key={title}>
              <h2 className="text-xl font-bold">
                {title}
                <LegalFlag />
              </h2>
              <div className="mt-2 space-y-3 text-[16px] leading-relaxed text-ink/85">
                {paras.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
