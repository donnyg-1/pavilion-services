import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { saveVendor } from "../../actions";

export const metadata = { title: "Vendors" };

function VendorFields({ v }: { v?: { name: string; contactName: string | null; email: string | null; phone: string | null } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Company" htmlFor={`n-${v?.name ?? "new"}`}>
        <Input id={`n-${v?.name ?? "new"}`} name="name" defaultValue={v?.name} required />
      </Field>
      <Field label="Contact" htmlFor={`c-${v?.name ?? "new"}`}>
        <Input id={`c-${v?.name ?? "new"}`} name="contactName" defaultValue={v?.contactName ?? ""} />
      </Field>
      <Field label="Email" htmlFor={`e-${v?.name ?? "new"}`}>
        <Input id={`e-${v?.name ?? "new"}`} name="email" type="email" defaultValue={v?.email ?? ""} />
      </Field>
      <Field label="Phone" htmlFor={`p-${v?.name ?? "new"}`}>
        <Input id={`p-${v?.name ?? "new"}`} name="phone" type="tel" defaultValue={v?.phone ?? ""} />
      </Field>
    </div>
  );
}

export default async function VendorsPage() {
  const vendors = await db.vendor.findMany({ include: { _count: { select: { deals: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Vendors</h1>
        <p className="text-muted">The local service companies that do the work. One hand-picked company per category.</p>
      </div>
      <div className="space-y-3">
        {vendors.map((v) => (
          <Card key={v.id} className="p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-display text-lg font-bold">{v.name}</span>
                  <span className="block text-sm text-muted">
                    {[v.contactName, v.email, v.phone].filter(Boolean).join(" · ") || "No contact info"} · {v._count.deals} {v._count.deals === 1 ? "deal" : "deals"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-navy-700">Edit</span>
              </summary>
              <ActionForm action={saveVendor.bind(null, v.id)} className="mt-4 space-y-3">
                <VendorFields v={v} />
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Add a vendor</h2>
        <ActionForm action={saveVendor.bind(null, null)} className="space-y-3">
          <VendorFields />
          <SubmitButton size="md">Add vendor</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
