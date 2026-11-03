"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { formatCents, parseDollars, parsePercent } from "@/lib/domain/money";
import { saveDeal, type DealFormData } from "../../actions";

type Option = { id: string; name: string };

export function DealForm({ dealId, initial, communities, vendors, hasBookings, locked }: { dealId: string | null; initial: DealFormData; communities: Option[]; vendors: Option[]; hasBookings: boolean; locked: boolean }) {
  const [d, setD] = useState<DealFormData>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = <K extends keyof DealFormData>(k: K, v: DealFormData[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (k: keyof DealFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  // Live preview of the money split on the starting price.
  const sample = parseDollars(d.tiers[d.tiers.length - 1]?.price ?? "") ?? 0;
  const c = parsePercent(d.commission) ?? 0;
  const m = parsePercent(d.managerShare) ?? 0;
  const h = parsePercent(d.hoaShare) ?? 0;
  const commission = Math.round((sample * c) / 10000);
  const base = d.shareBasis === "price" ? sample : commission;
  const mgr = Math.round((base * m) / 10000);
  const hoa = Math.round((base * h) / 10000);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveDeal(dealId, d);
      if (r && !r.ok) {
        setErrors(r.errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const section = "p-5 sm:p-6 space-y-4";
  return (
    <form onSubmit={submit} className="space-y-5">
      {errors.length ? (
        <Notice tone="error" title="Fix these and save again">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Card className={section}>
        <h2 className="text-lg font-bold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" hint="What residents see, e.g. Gutter Day">
            <Input id="title" value={d.title} onChange={text("title")} />
          </Field>
          <Field label="Service" htmlFor="serviceName" hint="e.g. Gutter cleaning">
            <Input id="serviceName" value={d.serviceName} onChange={text("serviceName")} />
          </Field>
          <Field label="Community" htmlFor="communityId" hint={<Link href="/admin/communities" className="text-navy-700">Add a community</Link>}>
            <Select id="communityId" value={d.communityId} onChange={text("communityId")}>
              <option value="">Choose…</option>
              {communities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vendor" htmlFor="vendorId" hint={<Link href="/admin/vendors" className="text-navy-700">Add a vendor</Link>}>
            <Select id="vendorId" value={d.vendorId} onChange={text("vendorId")}>
              <option value="">Choose…</option>
              {vendors.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Link name" htmlFor="slug" hint={`Residents' link: /d/${d.slug || "…"}`}>
            <Input id="slug" value={d.slug} onChange={text("slug")} placeholder="sunset-ridge-gutter-day" />
          </Field>
          <Field label="Status" htmlFor="status" hint="Residents can only book open deals.">
            <Select id="status" value={d.status} onChange={text("status")}>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        <Field label="Description" htmlFor="description" hint="One or two sentences on the deal page.">
          <Textarea id="description" rows={2} value={d.description} onChange={text("description")} />
        </Field>
        <Field label="What's included" htmlFor="whatsIncluded" hint="One item per line.">
          <Textarea id="whatsIncluded" rows={4} value={d.whatsIncluded} onChange={text("whatsIncluded")} />
        </Field>
      </Card>

      <Card className={section}>
        <h2 className="text-lg font-bold">Schedule and capacity</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Service date" htmlFor="serviceDate">
            <Input id="serviceDate" type="date" value={d.serviceDate} onChange={text("serviceDate")} />
          </Field>
          <Field label="Weather backup date" htmlFor="backupDate">
            <Input id="backupDate" type="date" value={d.backupDate} onChange={text("backupDate")} />
          </Field>
          <Field label="Arrival window" htmlFor="arrivalWindow" hint="Optional, e.g. 8am–4pm">
            <Input id="arrivalWindow" value={d.arrivalWindow} onChange={text("arrivalWindow")} />
          </Field>
          <Field label="Signups close" htmlFor="signupDeadline" hint="Mountain Time. The price locks here.">
            <Input id="signupDeadline" type="datetime-local" value={d.signupDeadline} onChange={text("signupDeadline")} />
          </Field>
          <Field label="Max homes" htmlFor="capacity" hint="Vendor capacity. Waitlist after this.">
            <Input id="capacity" type="number" min={1} inputMode="numeric" value={d.capacity} onChange={text("capacity")} />
          </Field>
        </div>
        {locked ? <Notice tone="warn">The price is locked because signups closed. Moving the deadline into the future reopens signups and unlocks pricing.</Notice> : null}
      </Card>

      <Card className={section}>
        <div>
          <h2 className="text-lg font-bold">Pricing</h2>
          <p className="text-sm text-muted">The price drops as more homes book and never goes back up. Everyone pays the final tier.</p>
        </div>
        <Field label="Normal price" htmlFor="normalPrice" hint="What this usually costs. Shown crossed out." className="sm:max-w-xs">
          <DollarInput id="normalPrice" value={d.normalPrice} onChange={(v) => set("normalPrice", v)} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Group price tiers</p>
          <div className="space-y-2">
            {d.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-sm text-muted">{i === 0 ? "From" : "At"}</span>
                <Input
                  aria-label="Homes"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="w-24"
                  value={t.minHomes}
                  onChange={(e) => set("tiers", d.tiers.map((x, j) => (j === i ? { ...x, minHomes: e.target.value } : x)))}
                />
                <span className="shrink-0 text-sm text-muted">homes →</span>
                <DollarInput aria-label="Price" className="w-32" value={t.price} onChange={(v) => set("tiers", d.tiers.map((x, j) => (j === i ? { ...x, price: v } : x)))} />
                {d.tiers.length > 1 ? (
                  <button type="button" onClick={() => set("tiers", d.tiers.filter((_, j) => j !== i))} className="px-2 text-sm font-semibold text-muted hover:text-danger">
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => set("tiers", [...d.tiers, { minHomes: "", price: "" }])}>
            + Add tier
          </Button>
          {hasBookings ? <p className="mt-1 text-sm text-muted">This deal has bookings. Changing tiers changes the price everyone pays.</p> : null}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold">Add-ons <span className="font-normal text-muted">(optional, flat price, same visit)</span></p>
          <div className="space-y-2">
            {d.addOns.map((a, i) => (
              <div key={a.id ?? `new-${i}`} className="grid grid-cols-[1fr_8rem_auto] gap-2 sm:grid-cols-[1fr_1.4fr_8rem_auto]">
                <Input aria-label="Add-on name" placeholder="Name" value={a.name} onChange={(e) => set("addOns", d.addOns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Add-on description" placeholder="Short description" className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" value={a.description} onChange={(e) => set("addOns", d.addOns.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                <DollarInput aria-label="Add-on price" value={a.price} onChange={(v) => set("addOns", d.addOns.map((x, j) => (j === i ? { ...x, price: v } : x)))} />
                <button type="button" onClick={() => set("addOns", d.addOns.filter((_, j) => j !== i))} className="px-2 text-sm font-semibold text-muted hover:text-danger">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => set("addOns", [...d.addOns, { name: "", description: "", price: "" }])}>
            + Add add-on
          </Button>
        </div>
      </Card>

      <Card className={section}>
        <div>
          <h2 className="text-lg font-bold">Money split</h2>
          <p className="text-sm text-muted">Per completed job. Card processing comes out of the vendor&apos;s payout, not the commission.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Pavilion commission" htmlFor="commission">
            <PercentInput id="commission" value={d.commission} onChange={(v) => set("commission", v)} />
          </Field>
          <Field label="Manager share" htmlFor="managerShare">
            <PercentInput id="managerShare" value={d.managerShare} onChange={(v) => set("managerShare", v)} />
          </Field>
          <Field label="HOA reserve share" htmlFor="hoaShare">
            <PercentInput id="hoaShare" value={d.hoaShare} onChange={(v) => set("hoaShare", v)} />
          </Field>
          <Field label="Shares are a % of" htmlFor="shareBasis">
            <Select id="shareBasis" value={d.shareBasis} onChange={text("shareBasis")}>
              <option value="price">Final price</option>
              <option value="commission">Pavilion commission</option>
            </Select>
          </Field>
        </div>
        {sample > 0 ? (
          <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm">
            <p className="font-semibold">At the lowest tier ({formatCents(sample)}):</p>
            <p className="mt-1 text-muted">
              Commission {formatCents(commission, { showZeroCents: true })} → manager {formatCents(mgr, { showZeroCents: true })}, HOA {formatCents(hoa, { showZeroCents: true })}, Pavilion keeps{" "}
              <span className={cx("font-semibold", commission - mgr - hoa < 0 ? "text-danger" : "text-ink")}>{formatCents(commission - mgr - hoa, { showZeroCents: true })}</span>. Vendor gets {formatCents(sample - commission, { showZeroCents: true })} minus card fees.
            </p>
          </div>
        ) : null}
      </Card>

      <Card className={section}>
        <div>
          <h2 className="text-lg font-bold">Neighbor referrals</h2>
          <p className="text-sm text-muted">
            Each booked home gets a share link. Every neighbor who books with it takes this much off the referrer&apos;s job, up to the cap. The credit comes off the price charged, so the commission, HOA, manager and vendor shares all shrink with it. Set it to 0 to turn it off.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Credit per neighbor" htmlFor="referralCredit">
            <DollarInput id="referralCredit" value={d.referralCredit} onChange={(v) => set("referralCredit", v)} />
          </Field>
          <Field label="Max credit per home" htmlFor="referralCap">
            <DollarInput id="referralCap" value={d.referralCap} onChange={(v) => set("referralCap", v)} />
          </Field>
        </div>
      </Card>

      <Card className={section}>
        <div>
          <h2 className="text-lg font-bold">Copy</h2>
          <p className="text-sm text-muted">Use {"{community}"} and {"{vendor}"} as placeholders.</p>
        </div>
        <Field label="Reserve fund line" htmlFor="reserveFundLine">
          <Input id="reserveFundLine" value={d.reserveFundLine} onChange={text("reserveFundLine")} />
        </Field>
        <Field label="Satisfaction guarantee" htmlFor="guaranteeLine">
          <Input id="guaranteeLine" value={d.guaranteeLine} onChange={text("guaranteeLine")} />
        </Field>
        <Field label="Cancellation policy" htmlFor="cancellationPolicy">
          <Input id="cancellationPolicy" value={d.cancellationPolicy} onChange={text("cancellationPolicy")} />
        </Field>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-stone-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href={dealId ? `/admin/deals/${dealId}` : "/admin"} className="text-sm font-semibold text-muted">
          Cancel
        </Link>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Saving…" : dealId ? "Save changes" : "Create deal"}
        </Button>
      </div>
    </form>
  );
}

function DollarInput({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void; className?: string; id?: string; "aria-label"?: string }) {
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">$</span>
      <Input {...rest} inputMode="decimal" className="pl-7" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PercentInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" className="pr-8" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted">%</span>
    </div>
  );
}
