"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, Icon, Input, Notice, Textarea, cx } from "@/components/ui";
import { formatCents } from "@/lib/domain/money";
import { readAttribution } from "./attribution";
import { submitBooking, submitReview, submitWaitlist, type BookingFormState, type Contact } from "./actions";

type Props = {
  slug: string;
  communityName: string;
  vendorName: string;
  priceCents: number;
  addOns: { id: string; name: string; description: string; priceCents: number }[];
  src: string | null;
  refCode: string | null;
  full: boolean;
};

const empty: Contact = { name: "", email: "", phone: "", street: "", unit: "" };

export function BookingForm({ slug, communityName, vendorName, priceCents, addOns, src, refCode, full }: Props) {
  const [contact, setContact] = useState<Contact>(empty);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<"book" | "waitlist">(full ? "waitlist" : "book");
  const [side, setSide] = useState<{ kind: "review" | "waitlist"; ok: boolean; message?: string } | null>(null);
  const [sidePending, startSide] = useTransition();
  const [state, dispatch, pending] = useActionState<BookingFormState, FormData>(submitBooking.bind(null, slug), { result: null, at: 0 });
  const [, startTransition] = useTransition();

  const result = state.result;
  const fieldErrors = result?.kind === "invalid" ? result.fieldErrors : {};
  const addOnTotal = addOns.filter((a) => selected.includes(a.id)).reduce((s, a) => s + a.priceCents, 0);
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [k]: e.target.value }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSide(null);
    const fd = new FormData(e.currentTarget);
    const attr = readAttribution(slug, { src, ref: refCode });
    fd.set("src", attr.src ?? "");
    fd.set("ref", attr.ref ?? "");
    // Dispatch inside a transition (not <form action>) so React doesn't clear the form.
    startTransition(() => dispatch(fd));
  }

  function requestReview() {
    startSide(async () => {
      const r = await submitReview(slug, contact);
      setSide({ kind: "review", ok: r.ok, message: r.ok ? undefined : r.message });
    });
  }

  function joinWaitlist(e?: React.FormEvent) {
    e?.preventDefault();
    const attr = readAttribution(slug, { src, ref: refCode });
    startSide(async () => {
      const r = await submitWaitlist(slug, contact, attr.src, attr.ref);
      setSide({ kind: "waitlist", ok: r.ok, message: r.ok ? undefined : r.message });
    });
  }

  if (side?.ok) {
    return (
      <div className="animate-rise py-2 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-pine-100 text-pine-700">
          <Icon name="check" className="size-6" />
        </div>
        <h3 className="mt-3 text-xl font-bold">{side.kind === "review" ? "Thanks, we're checking" : "You're on the waitlist"}</h3>
        <p className="mt-1.5 text-muted">
          {side.kind === "review"
            ? `We'll confirm your address with ${communityName} and email ${contact.email} soon.`
            : `If a spot opens before signups close, we'll email ${contact.email} right away.`}
        </p>
      </div>
    );
  }

  const contactFields = (
    <>
      <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" autoComplete="name" required value={contact.name} onChange={set("name")} aria-invalid={!!fieldErrors.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={contact.email} onChange={set("email")} aria-invalid={!!fieldErrors.email} />
        </Field>
        <Field label="Mobile phone" htmlFor="phone" error={fieldErrors.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={contact.phone} onChange={set("phone")} aria-invalid={!!fieldErrors.phone} />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Field label="Street address" htmlFor="street" error={fieldErrors.street}>
          <Input id="street" name="street" autoComplete="address-line1" placeholder="1234 N 500 E" required value={contact.street} onChange={set("street")} aria-invalid={!!fieldErrors.street} />
        </Field>
        <Field label="Unit" htmlFor="unit">
          <Input id="unit" name="unit" autoComplete="address-line2" placeholder="Optional" value={contact.unit} onChange={set("unit")} />
        </Field>
      </div>
    </>
  );

  if (mode === "waitlist") {
    return (
      <form onSubmit={joinWaitlist} className="space-y-4">
        <Notice tone="warn" title="This service day is full">
          {vendorName} has booked every spot they can handle. Join the waitlist and we&apos;ll email you if one opens.
        </Notice>
        {contactFields}
        {side && !side.ok ? <Notice tone="error">{side.message}</Notice> : null}
        <Button type="submit" size="lg" className="w-full" disabled={sidePending}>
          {sidePending ? "Joining…" : "Join the waitlist"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {contactFields}

      {result?.kind === "not_on_list" ? (
        <Notice tone="warn" title={`We couldn't find that address on ${communityName}'s list`} className="animate-rise">
          <p>Check the house number and direction (N/S/E/W). Still not working? We&apos;ll check it for you.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={requestReview} disabled={sidePending}>
            {sidePending ? "Sending…" : "Not on the list? Request review"}
          </Button>
          {side && !side.ok ? <p className="mt-2 text-sm text-danger">{side.message}</p> : null}
        </Notice>
      ) : null}
      {result?.kind === "already_booked" ? (
        <Notice tone="info" title="This address is already booked" className="animate-rise">
          We just re-sent the confirmation to the email on file for this home. You can use the link in it to view or cancel.
        </Notice>
      ) : null}
      {result?.kind === "full" ? (
        <Notice tone="warn" title="The last spot was just taken" className="animate-rise">
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setMode("waitlist")}>
            Join the waitlist
          </Button>
        </Notice>
      ) : null}
      {result?.kind === "closed" ? <Notice tone="warn" title="Signups for this service day have closed." /> : null}
      {result?.kind === "error" ? <Notice tone="error">{result.message}</Notice> : null}

      {addOns.length > 0 ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Add to the same visit <span className="font-normal text-muted">(optional)</span></legend>
          <div className="space-y-2">
            {addOns.map((a) => {
              const on = selected.includes(a.id);
              return (
                <label key={a.id} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition", on ? "border-pine-600 bg-pine-100/50" : "border-line bg-white hover:border-sage-300")}>
                  <input
                    type="checkbox"
                    name="addOn"
                    value={a.id}
                    checked={on}
                    onChange={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                    className="mt-0.5 size-5 shrink-0 accent-pine-700"
                  />
                  <span className="flex-1">
                    <span className="block font-semibold">{a.name}</span>
                    {a.description ? <span className="block text-sm text-muted">{a.description}</span> : null}
                  </span>
                  <span className="font-semibold">+{formatCents(a.priceCents)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Field label={<>Notes for the crew <span className="font-normal text-muted">(optional)</span></>} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} className="min-h-0" placeholder="Gate code, dog in the yard, side gate on the left…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="rounded-xl bg-sage-100 px-4 py-3 text-[15px]">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">Today&apos;s price{addOnTotal ? " with add-ons" : ""}</span>
          <span className="font-display text-xl font-bold">{formatCents(priceCents + addOnTotal)}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">Can only go down as neighbors book. Charged after the job is done.</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" name="agreed" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-pine-700" aria-invalid={!!fieldErrors.agreed} />
        <span>
          I agree to the{" "}
          <Link href={`/d/${slug}/terms`} target="_blank" className="font-semibold text-pine-700 underline underline-offset-2">
            booking terms
          </Link>{" "}
          and authorize Pavilion to charge my card the final price after {vendorName} completes the job.
        </span>
      </label>
      {fieldErrors.agreed ? <p className="-mt-2 text-sm font-medium text-danger">{fieldErrors.agreed}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Checking your address…" : (
          <>
            Continue to save card <Icon name="arrow" className="size-5" />
          </>
        )}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted">
        <Icon name="shield" className="size-4" /> Secure card entry by Stripe. You won&apos;t be charged today.
      </p>
    </form>
  );
}
