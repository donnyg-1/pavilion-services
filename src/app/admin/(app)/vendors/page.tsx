import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Badge, Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { isoDate, mountainToday } from "@/lib/dates";
import { vendorReadiness } from "@/lib/domain/vendor";
import type { Vendor } from "@/generated/prisma/client";
import { saveVendor } from "../../actions";

export const metadata = { title: "Vendors" };

function VendorFields({ v }: { v?: Vendor }) {
  const k = v?.id ?? "new";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Company" htmlFor={`n-${k}`}>
          <Input id={`n-${k}`} name="name" defaultValue={v?.name} required />
        </Field>
        <Field label="Contact" htmlFor={`c-${k}`}>
          <Input id={`c-${k}`} name="contactName" defaultValue={v?.contactName ?? ""} />
        </Field>
        <Field label="Email" htmlFor={`e-${k}`} hint="The route list goes here when signups close.">
          <Input id={`e-${k}`} name="email" type="email" defaultValue={v?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor={`p-${k}`}>
          <Input id={`p-${k}`} name="phone" type="tel" defaultValue={v?.phone ?? ""} />
        </Field>
      </div>
      <fieldset className="rounded-2xl bg-stone-50 p-4">
        <legend className="px-1 text-sm font-semibold">Onboarding checklist</legend>
        <p className="mb-3 text-sm text-muted">Signups can&apos;t open for this vendor until all three are on file.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Insurance expires" htmlFor={`i-${k}`} hint="From their certificate of insurance. Ask to be named as additional insured.">
            <Input id={`i-${k}`} name="insuranceExpiresAt" type="date" defaultValue={v?.insuranceExpiresAt ? isoDate(v.insuranceExpiresAt) : ""} />
          </Field>
          <Field label="Agreement signed" htmlFor={`a-${k}`} hint="Leave empty until they've signed.">
            <Input id={`a-${k}`} name="agreementSignedAt" type="date" defaultValue={v?.agreementSignedAt ? isoDate(v.agreementSignedAt) : ""} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Bank details</p>
            <label className="flex h-[50px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3.5">
              <input type="checkbox" name="payoutDetails" defaultChecked={!!v?.payoutDetailsAt} className="size-5 accent-navy-700" />
              <span className="text-sm">Received{v?.payoutDetailsAt ? <span className="text-muted"> {isoDate(v.payoutDetailsAt)}</span> : null}</span>
            </label>
          </div>
        </div>
        <Field label="Insurance notes" htmlFor={`in-${k}`} className="mt-3">
          <Input id={`in-${k}`} name="insuranceNote" placeholder="Carrier, policy number, where the certificate is saved" defaultValue={v?.insuranceNote ?? ""} />
        </Field>
      </fieldset>
    </div>
  );
}

export default async function VendorsPage() {
  const vendors = await db.vendor.findMany({ include: { _count: { select: { deals: true } } }, orderBy: { name: "asc" } });
  const today = mountainToday();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Vendors</h1>
        <p className="text-muted">The local service companies that do the work. One hand-picked company per category.</p>
      </div>
      <div className="space-y-3">
        {vendors.map((v) => {
          const r = vendorReadiness(v, today);
          return (
            <Card key={v.id} className="p-4">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold">{v.name}</span>
                      {r.ready ? <Badge tone="green">Ready</Badge> : <Badge tone="honey">Not ready</Badge>}
                    </span>
                    <span className="block text-sm text-muted">
                      {[v.contactName, v.email, v.phone].filter(Boolean).join(" · ") || "No contact info"} · {v._count.deals} {v._count.deals === 1 ? "deal" : "deals"}
                    </span>
                    {!r.ready ? <span className="block text-sm text-[#8a6418]">Missing: {r.missing.join(", ")}</span> : null}
                  </span>
                  <span className="text-sm font-semibold text-navy-700">Edit</span>
                </summary>
                <ActionForm action={saveVendor.bind(null, v.id)} className="mt-4 space-y-3">
                  <VendorFields v={v} />
                  <SubmitButton>Save</SubmitButton>
                </ActionForm>
              </details>
            </Card>
          );
        })}
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
