import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { formatCents } from "@/lib/domain/money";
import { mockPay } from "../../actions";
import { MockShell } from "../../shell";

export const dynamic = "force-dynamic";

export default async function MockPay({ params }: { params: Promise<{ chargeId: string }> }) {
  if (config.paymentsMode() !== "mock") notFound();
  const { chargeId } = await params;
  const charge = await db.charge.findUnique({ where: { id: chargeId }, include: { booking: { include: { deal: true } } } });
  if (!charge) notFound();
  return (
    <MockShell>
      <p className="text-sm text-[#697386]">Pay Pavilion</p>
      <p className="mt-1 text-3xl font-semibold text-[#1a1f36]">{formatCents(charge.amountCents, { showZeroCents: true })}</p>
      <p className="mt-1 text-sm text-[#697386]">{charge.booking.deal.title}</p>
      <form action={mockPay.bind(null, chargeId)} className="mt-6">
        <div className="rounded-lg border border-[#e3e8ee] px-3 py-3 text-sm text-[#1a1f36]">Visa •••• 4242 (test)</div>
        <button type="submit" className="mt-4 h-11 w-full rounded-md bg-[#635bff] font-medium text-white hover:bg-[#5249e0]">
          Pay
        </button>
      </form>
    </MockShell>
  );
}
