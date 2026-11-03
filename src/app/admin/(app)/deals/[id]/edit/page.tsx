import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dealInclude } from "@/lib/services/deals";
import { DealForm } from "../../deal-form";
import { dealToForm } from "../../form-data";

export const metadata = { title: "Edit deal" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await db.deal.findUnique({ where: { id }, include: dealInclude });
  if (!deal) notFound();
  const [communities, vendors, bookings] = await Promise.all([
    db.community.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.booking.count({ where: { dealId: id, status: { notIn: ["expired"] } } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/admin/deals/${id}`} className="text-sm font-semibold text-navy-700">← {deal.title}</Link>
      <h1 className="text-3xl font-extrabold">Edit deal</h1>
      <DealForm dealId={id} initial={dealToForm(deal)} communities={communities} vendors={vendors} hasBookings={bookings > 0} locked={!!deal.lockedAt} />
    </div>
  );
}
