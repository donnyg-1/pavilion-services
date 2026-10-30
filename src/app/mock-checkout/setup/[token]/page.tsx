import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { MOCK_CARDS } from "@/lib/payments/mock";
import { authorizationText } from "@/lib/services/booking";
import { mockSaveCard } from "../../actions";
import { MockShell } from "../../shell";

export const dynamic = "force-dynamic";

export default async function MockSetup({ params }: { params: Promise<{ token: string }> }) {
  if (config.paymentsMode() !== "mock") notFound();
  const { token } = await params;
  const booking = await db.booking.findUnique({ where: { publicToken: token }, include: { resident: true, deal: { include: { vendor: true, community: true } } } });
  if (!booking) notFound();

  return (
    <MockShell>
      <p className="text-sm text-[#697386]">Pavilion</p>
      <h1 className="mt-1 text-xl font-semibold text-[#1a1f36]" style={{ fontFamily: "inherit" }}>Save a card for {booking.deal.title}</h1>
      <p className="mt-1 text-sm text-[#697386]">{booking.resident.email}</p>
      <form action={mockSaveCard.bind(null, token)} className="mt-6 space-y-3">
        <p className="text-sm font-medium text-[#1a1f36]">Pick a test card</p>
        {Object.entries(MOCK_CARDS).map(([id, c], i) => (
          <label key={id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e3e8ee] px-3 py-3 text-sm has-[:checked]:border-[#635bff] has-[:checked]:ring-1 has-[:checked]:ring-[#635bff]">
            <input type="radio" name="card" value={id} defaultChecked={i === 0} className="accent-[#635bff]" />
            <span className="flex-1">
              <span className="block font-medium capitalize text-[#1a1f36]">
                {c.brand} •••• {c.last4}
              </span>
              <span className="text-[#697386]">{c.label}</span>
            </span>
          </label>
        ))}
        <p className="pt-2 text-xs leading-relaxed text-[#697386]">{authorizationText(booking.deal)}</p>
        <button type="submit" className="h-11 w-full rounded-md bg-[#635bff] font-medium text-white hover:bg-[#5249e0]">
          Save card
        </button>
      </form>
      <Link href={`/d/${booking.deal.slug}?checkout=cancelled`} className="mt-4 block text-center text-sm text-[#635bff]">
        ← Back
      </Link>
    </MockShell>
  );
}
