import Link from "next/link";
import { db } from "@/lib/db";
import { DealForm } from "../deal-form";
import { blankDealForm } from "../form-data";

export const metadata = { title: "New deal" };

export default async function NewDealPage() {
  const [communities, vendors] = await Promise.all([
    db.community.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const initial = blankDealForm();
  if (communities.length === 1) initial.communityId = communities[0].id;
  if (vendors.length === 1) initial.vendorId = vendors[0].id;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm font-semibold text-pine-700">← Deals</Link>
      <h1 className="text-3xl font-extrabold">New deal</h1>
      <DealForm dealId={null} initial={initial} communities={communities} vendors={vendors} hasBookings={false} locked={false} />
    </div>
  );
}
