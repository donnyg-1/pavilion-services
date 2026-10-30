import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseSource } from "@/lib/services/booking";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { slug?: string; visitorId?: string; src?: string | null; ref?: string | null };
    if (!body.slug || !body.visitorId || body.visitorId.length > 64) return NextResponse.json({ ok: false }, { status: 400 });
    const deal = await db.deal.findUnique({ where: { slug: body.slug }, select: { id: true } });
    if (!deal) return NextResponse.json({ ok: false }, { status: 404 });
    // First touch wins: one row per browser per deal.
    await db.dealVisit.createMany({ data: [{ dealId: deal.id, visitorId: body.visitorId, source: parseSource(body.src, body.ref) }], skipDuplicates: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
