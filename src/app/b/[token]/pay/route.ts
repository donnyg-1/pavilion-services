import { NextResponse } from "next/server";
import { url } from "@/lib/config";
import { startRecoveryPayment } from "@/lib/services/charging";

// Payment link from the "payment failed" email. Creates a fresh checkout each time,
// so the emailed link never expires.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await startRecoveryPayment(token);
  if ("error" in r) return NextResponse.redirect(url(`/b/${token}`), 303);
  return NextResponse.redirect(r.url.startsWith("http") ? r.url : url(r.url), 303);
}
