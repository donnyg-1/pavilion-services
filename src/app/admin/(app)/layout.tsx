import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Logo } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { logout } from "../actions";
import { NavLinks } from "./nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Pavilion admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const payments = config.paymentsMode();
  const email = config.emailMode();
  const sms = config.smsMode();
  return (
    <div className="min-h-dvh bg-sage-50">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Logo href="/admin" suffix="admin" />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin/outbox" className="hidden sm:inline-flex">
              <Badge tone={payments === "stripe" ? "blue" : "honey"} title="Payments mode">
                {payments === "stripe" ? "Stripe test" : "Mock payments"}
              </Badge>
            </Link>
            <Link href="/admin/outbox" className="hidden sm:inline-flex">
              <Badge tone={email === "resend" ? "blue" : "honey"} title="Email mode">
                {email === "resend" ? "Resend" : "Emails → Outbox"}
              </Badge>
            </Link>
            <Link href="/admin/outbox" className="hidden sm:inline-flex">
              <Badge tone={sms === "twilio" ? "blue" : "honey"} title="Text mode">
                {sms === "twilio" ? "Twilio" : "Texts → Outbox"}
              </Badge>
            </Link>
            <form action={logout}>
              <button className="text-sm font-semibold text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
        <NavLinks />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
