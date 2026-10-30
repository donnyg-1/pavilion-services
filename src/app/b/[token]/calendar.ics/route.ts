import { db } from "@/lib/db";
import { url } from "@/lib/config";
import { addDays, isoDate } from "@/lib/dates";
import { bookingAddress } from "@/lib/services/deals";

const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await db.booking.findUnique({ where: { publicToken: token }, include: { communityAddress: true, deal: { include: { vendor: true } } } });
  if (!b) return new Response("Not found", { status: 404 });
  const day = isoDate(b.deal.serviceDate).replace(/-/g, "");
  const next = addDays(isoDate(b.deal.serviceDate), 1).replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pavilion//Services//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@pavilion`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(`${b.deal.title}: ${b.deal.vendor.name}`)}`,
    `LOCATION:${esc(bookingAddress(b))}`,
    `DESCRIPTION:${esc(`${b.deal.arrivalWindow ? `Arrival window: ${b.deal.arrivalWindow}. ` : ""}Unlock side gates and keep pets inside. Manage booking: ${url(`/b/${token}`)}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${b.deal.slug}.ics"` } });
}
