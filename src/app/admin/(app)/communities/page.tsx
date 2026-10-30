import Link from "next/link";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { CommunityForm } from "./community-form";

export const metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  const [communities, companies] = await Promise.all([
    db.community.findMany({ include: { managementCompany: true, _count: { select: { addresses: { where: { active: true } }, deals: true } } }, orderBy: { name: "asc" } }),
    db.managementCompany.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Communities</h1>
        <p className="text-muted">Each community has an address list. Only addresses on the list can book.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {communities.map((c) => (
          <Link key={c.id} href={`/admin/communities/${c.id}`}>
            <Card className="p-4 transition hover:border-sage-300">
              <p className="font-display text-lg font-bold">{c.name}</p>
              <p className="text-sm text-muted">
                {[c.city, c.managementCompany?.name].filter(Boolean).join(" · ") || "No management company"}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{c._count.addresses}</span> homes on the list · <span className="font-semibold">{c._count.deals}</span> {c._count.deals === 1 ? "deal" : "deals"}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Add a community</h2>
        <CommunityForm companies={companies} />
      </Card>
    </div>
  );
}
