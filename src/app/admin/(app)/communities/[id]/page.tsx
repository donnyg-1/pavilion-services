import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import { setAddressActive, uploadAddresses } from "../../../actions";
import { CommunityForm } from "../community-form";

export const metadata = { title: "Community" };

export default async function CommunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; show?: string }> }) {
  const { id } = await params;
  const { q = "", show } = await searchParams;
  const community = await db.community.findUnique({ where: { id }, include: { deals: { select: { id: true, title: true } } } });
  if (!community) notFound();
  const companies = await db.managementCompany.findMany({ orderBy: { name: "asc" } });
  const [activeCount, inactiveCount] = await Promise.all([
    db.communityAddress.count({ where: { communityId: id, active: true } }),
    db.communityAddress.count({ where: { communityId: id, active: false } }),
  ]);
  const addresses = await db.communityAddress.findMany({
    where: { communityId: id, active: show !== "removed", ...(q ? { OR: [{ raw: { contains: q, mode: "insensitive" } }, { normalized: { contains: q.toUpperCase() } }] } : {}) },
    orderBy: { normalized: "asc" },
    take: 250,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/communities" className="text-sm font-semibold text-pine-700">← Communities</Link>
        <h1 className="mt-2 text-3xl font-extrabold">{community.name}</h1>
        <p className="text-muted">
          {activeCount} homes on the address list
          {community.deals.length ? (
            <>
              {" · "}
              {community.deals.map((d, i) => (
                <span key={d.id}>
                  {i ? ", " : ""}
                  <Link href={`/admin/deals/${d.id}`} className="font-semibold text-pine-700">{d.title}</Link>
                </span>
              ))}
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-bold">Upload address list</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            A CSV with a column named <code>address</code> (or <code>street</code>, <code>property address</code>), and optionally <code>unit</code>. A plain list of one address per line works too. Addresses are normalized, so &ldquo;1234 North 500 East&rdquo; matches &ldquo;1234 N 500 E&rdquo;.
          </p>
          <ActionForm action={uploadAddresses.bind(null, id)} className="space-y-4">
            <Field label="CSV file" htmlFor="file">
              <Input id="file" name="file" type="file" accept=".csv,text/csv,text/plain" className="py-2 file:mr-3 file:rounded-full file:border-0 file:bg-sage-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-pine-800" />
            </Field>
            <Field label="…or paste addresses" htmlFor="text">
              <Textarea id="text" name="text" rows={4} placeholder={"address,unit\n1234 N 500 E,\n88 W Willow Creek Dr,"} className="font-mono text-sm" />
            </Field>
            <fieldset className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" value="append" defaultChecked className="accent-pine-700" /> Add to the existing list
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" value="replace" className="accent-pine-700" /> Replace the list (addresses not in the file are removed)
              </label>
            </fieldset>
            <SubmitButton size="md" pendingText="Uploading…">Upload</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">Details</h2>
          <CommunityForm community={community} companies={companies} />
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{show === "removed" ? "Removed addresses" : "Address list"}</h2>
          <form className="flex gap-2">
            {show ? <input type="hidden" name="show" value={show} /> : null}
            <Input name="q" defaultValue={q} placeholder="Search" className="h-9 w-48 py-1.5 text-sm" />
          </form>
        </div>
        <p className="mt-1 text-sm text-muted">
          {show === "removed" ? (
            <Link href={`/admin/communities/${id}`} className="font-semibold text-pine-700">Show active</Link>
          ) : inactiveCount ? (
            <Link href={`/admin/communities/${id}?show=removed`} className="font-semibold text-pine-700">Show {inactiveCount} removed</Link>
          ) : null}
          {addresses.length === 250 ? " Showing the first 250. Search to narrow down." : null}
        </p>
        <ul className="mt-3 grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {addresses.map((a) => (
            <li key={a.id} className="group flex items-center justify-between gap-2 border-b border-line py-1.5">
              <span>
                {a.raw}
                {a.raw.toUpperCase() !== a.normalized ? <span className="ml-1.5 font-mono text-[11px] text-muted">{a.normalized}</span> : null}
              </span>
              <ActionForm action={setAddressActive.bind(null, a.id, id, !a.active)} inline>
                <SubmitButton variant="ghost" className="h-7 px-2 text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100">
                  {a.active ? "Remove" : "Restore"}
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        {addresses.length === 0 ? <p className="py-6 text-center text-muted">No addresses yet. Upload a CSV above.</p> : null}
      </Card>
    </div>
  );
}
