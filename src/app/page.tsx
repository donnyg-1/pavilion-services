import Link from "next/link";
import { Card, Icon, Logo } from "@/components/ui";
import { db } from "@/lib/db";
import { formatServiceDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Residents arrive on a deal link, not here. This page lists open deals for convenience.
export default async function Home() {
  const deals = await db.deal.findMany({ where: { status: "open" }, include: { community: true, vendor: true }, orderBy: { serviceDate: "asc" } });
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Logo />
      <h1 className="mt-10 text-4xl font-extrabold text-ink sm:text-5xl">Neighborhood service days</h1>
      <p className="mt-3 text-lg text-muted">Vetted local pros for your HOA community. The more neighbors book, the less everyone pays. No app, no account.</p>
      <div className="mt-8 space-y-3">
        {deals.map((d) => (
          <Link key={d.id} href={`/d/${d.slug}`} className="block">
            <Card className="flex items-center justify-between gap-4 p-5 transition hover:border-stone-300">
              <div>
                <p className="text-sm text-muted">{d.community.name}</p>
                <p className="font-display text-xl font-bold">{d.title}</p>
                <p className="text-sm text-muted">
                  {d.vendor.name} · {formatServiceDate(d.serviceDate)}
                </p>
              </div>
              <Icon name="arrow" className="size-5 text-navy-700" />
            </Card>
          </Link>
        ))}
        {deals.length === 0 ? <p className="text-muted">No open service days right now.</p> : null}
      </div>
      <p className="mt-12 text-sm text-muted">
        Pavilion staff? <Link href="/admin" className="font-semibold text-navy-700">Sign in</Link>
      </p>
    </main>
  );
}
