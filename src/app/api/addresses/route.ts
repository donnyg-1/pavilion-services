import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchesPartial } from "@/lib/domain/address";
import { findAddress } from "@/lib/services/booking";

// Address suggestions for the booking form, from the community's own list.
// Only answers once a house number is typed, and returns a handful of street
// addresses (never names), so it can't be used to page through the list.
// With &check=1 it answers whether one typed address is on the list, so the form can
// say so before the resident presses Book. It never says whether a home is booked.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("deal") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  if (searchParams.get("check")) {
    const deal = await db.deal.findUnique({ where: { slug }, select: { communityId: true, status: true } });
    if (!deal || deal.status !== "open") return NextResponse.json({ onList: null });
    const { normalized, address } = await findAddress(deal.communityId, q, searchParams.get("unit") ?? "");
    return NextResponse.json({ onList: normalized ? !!address : null }, { headers: { "cache-control": "private, max-age=60" } });
  }
  const houseNumber = q.match(/^\d{2,}/)?.[0];
  if (!houseNumber) return NextResponse.json({ suggestions: [] });

  const deal = await db.deal.findUnique({ where: { slug }, select: { communityId: true, status: true } });
  if (!deal || deal.status !== "open") return NextResponse.json({ suggestions: [] });

  const candidates = await db.communityAddress.findMany({
    where: { communityId: deal.communityId, active: true, normalized: { startsWith: houseNumber } },
    select: { raw: true, normalized: true },
    orderBy: { normalized: "asc" },
    take: 200,
  });
  const suggestions = candidates.filter((a) => matchesPartial(a.normalized, q)).slice(0, 5).map((a) => a.raw);
  return NextResponse.json({ suggestions }, { headers: { "cache-control": "private, max-age=60" } });
}
