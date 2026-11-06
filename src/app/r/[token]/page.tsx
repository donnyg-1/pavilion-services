import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { RatingForm } from "./rating-form";
import { SaveMySpot } from "@/app/b/[token]/next-time";
import { CAN_SAVE_SPOT } from "@/lib/services/next-time";

export const metadata: Metadata = { title: "Rate your service", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RatePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ score?: string }> }) {
  const { token } = await params;
  const { score } = await searchParams;
  const booking = await db.booking.findUnique({ where: { publicToken: token }, include: { rating: true, resident: true, deal: { include: { vendor: true, community: true } } } });
  if (!booking) notFound();
  const fromLink = Number(score);
  const initial = Number.isInteger(fromLink) && fromLink >= 1 && fromLink <= 5 ? fromLink : (booking.rating?.score ?? null);

  return (
    <>
      <PublicHeader community={booking.deal.community.name} />
      <main className="mx-auto max-w-md px-4 py-6">
        <Card className="p-6">
          <p className="text-center text-sm font-semibold tracking-wide text-stone-600 uppercase">{booking.deal.title}</p>
          <h1 className="mt-2 text-center text-2xl font-extrabold">How did {booking.deal.vendor.name} do?</h1>
          <p className="mt-1 mb-6 text-center text-muted">Your rating helps us pick the best pros for {booking.deal.community.name}.</p>
          <RatingForm token={token} initialScore={initial} initialComment={booking.rating?.comment ?? ""} vendorName={booking.deal.vendor.name} />
        </Card>
        {CAN_SAVE_SPOT.includes(booking.status) ? (
          <div className="mt-4">
            <SaveMySpot token={token} initial={!!booking.nextTimeAt} title={booking.deal.title} email={booking.resident.email} />
          </div>
        ) : null}
      </main>
      <PublicFooter />
    </>
  );
}
