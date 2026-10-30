import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isoDate } from "@/lib/dates";
import { routeSortKey } from "@/lib/domain/address";
import { toCsv } from "@/lib/domain/csv";
import { SOURCE_LABELS } from "@/lib/services/admin";
import { bookingAddress, bookingInclude } from "@/lib/services/deals";

const dollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id, kind } = await params;
  const deal = await db.deal.findUnique({ where: { id }, include: { community: true, vendor: true } });
  if (!deal) return new Response("Not found", { status: 404 });

  let rows: (string | number | null)[][];
  if (kind === "route" || kind === "bookings") {
    const statuses = kind === "route" ? ["booked", "completed", "charged", "failed"] : undefined;
    const bookings = await db.booking.findMany({
      where: { dealId: id, ...(statuses ? { status: { in: statuses as never } } : {}) },
      include: { ...bookingInclude, charges: { orderBy: { createdAt: "desc" }, take: 1 }, rating: true, referredBy: { select: { resident: { select: { name: true } } } } },
    });
    bookings.sort((a, b) => {
      const [sa, na] = routeSortKey(a.communityAddress.normalized);
      const [sb, nb] = routeSortKey(b.communityAddress.normalized);
      return sa === sb ? na - nb : sa.localeCompare(sb);
    });
    rows =
      kind === "route"
        ? [
            ["Stop", "Address", "Name", "Phone", "Add-ons", "Notes for crew"],
            ...bookings.map((b, i) => [i + 1, bookingAddress(b), b.resident.name, b.resident.phone, b.addOns.map((a) => a.addOn.name).join("; "), b.notes]),
          ]
        : [
            ["Address", "Name", "Email", "Phone", "Status", "Source", "Referred by", "Add-ons", "Notes", "Booked at", "Amount", "Refunded", "Rating"],
            ...bookings.map((b) => [
              bookingAddress(b),
              b.resident.name,
              b.resident.email,
              b.resident.phone,
              b.status,
              SOURCE_LABELS[b.source],
              b.referredBy?.resident.name ?? "",
              b.addOns.map((a) => `${a.addOn.name} (${dollars(a.priceCents)})`).join("; "),
              b.notes,
              (b.bookedAt ?? b.createdAt).toISOString(),
              dollars(b.charges[0]?.amountCents),
              dollars(b.charges[0]?.refundedCents),
              b.rating?.score ?? "",
            ]),
          ];
  } else if (kind === "ledger") {
    const entries = await db.ledgerEntry.findMany({ where: { dealId: id }, include: { booking: { include: { communityAddress: true, resident: true } } }, orderBy: { createdAt: "asc" } });
    rows = [
      ["Date", "Type", "Address", "Resident", "Stripe ref", "Referral credit", "Final price", "Commission", "Manager share", "HOA share", "Pavilion keeps", "Processing fee", "Fee absorbed by Pavilion", "Vendor payout", "Fee estimated", "Commission %", "Manager %", "HOA %", "Share basis", "Vendor paid", "Manager paid", "HOA paid"],
      ...entries.map((e) => [
        e.createdAt.toISOString(),
        e.type,
        e.booking.communityAddress.raw,
        e.booking.resident.name,
        e.stripeRefId,
        dollars(e.referralCreditCents),
        dollars(e.finalPriceCents),
        dollars(e.commissionCents),
        dollars(e.managerShareCents),
        dollars(e.hoaShareCents),
        dollars(e.pavilionNetCents),
        dollars(e.processingFeeCents),
        dollars(e.feeAbsorbedCents),
        dollars(e.vendorPayoutCents),
        e.feeIsEstimate ? "yes" : "no",
        e.commissionBps / 100,
        e.managerShareBps / 100,
        e.hoaShareBps / 100,
        e.shareBasis,
        e.vendorPayoutStatus,
        e.managerPayoutStatus,
        e.hoaPayoutStatus,
      ]),
    ];
  } else if (kind === "waitlist") {
    const entries = await db.waitlistEntry.findMany({ where: { dealId: id }, orderBy: { createdAt: "asc" } });
    rows = [["Name", "Email", "Phone", "Address", "Source", "Joined"], ...entries.map((e) => [e.name, e.email, e.phone, e.address, SOURCE_LABELS[e.source], e.createdAt.toISOString()])];
  } else {
    return new Response("Unknown export", { status: 404 });
  }

  const filename = `${deal.slug}-${kind}-${isoDate(new Date())}.csv`;
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` } });
}
