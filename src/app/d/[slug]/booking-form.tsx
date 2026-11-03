"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { Button, Field, Icon, Input, Notice, Textarea, cx } from "@/components/ui";
import { formatCents } from "@/lib/domain/money";
import type { BookingResult } from "@/lib/services/booking";
import { readAttribution } from "./attribution";
import { AddressInput } from "./address-input";
import { finalize, mockWalletIdentity, prepare, submitReview, submitWaitlist, type Contact } from "./actions";
import { MockCard, MockWallet, StripeCard, StripeWallet, type CardDriver, type SaveCard } from "./payment-fields";

type Props = {
  slug: string;
  communityName: string;
  vendorName: string;
  priceCents: number;
  addOns: { id: string; name: string; description: string; priceCents: number }[];
  src: string | null;
  refCode: string | null;
  full: boolean;
  payments: { mode: "stripe" | "mock"; publishableKey: string };
};

const empty: Contact = { name: "", email: "", phone: "", street: "", unit: "" };

export function BookingForm(props: Props) {
  const { slug, communityName, vendorName, priceCents, addOns, payments } = props;
  const router = useRouter();
  const [contact, setContact] = useState<Contact>(empty);
  const [notes, setNotes] = useState("");
  const [texts, setTexts] = useState(false); // unticked: carriers want opt-in to be an active choice
  const [showNotes, setShowNotes] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"book" | "waitlist">(props.full ? "waitlist" : "book");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"wallet" | "card" | null>(null);
  const [walletShown, setWalletShown] = useState(payments.mode === "mock");
  const [side, setSide] = useState<{ kind: "review" | "waitlist"; ok: boolean; message?: string } | null>(null);
  const [sidePending, startSide] = useTransition();
  const card = useRef<CardDriver | null>(null);
  const registerCard = useCallback((d: CardDriver) => (card.current = d), []);
  const messages = useRef<HTMLDivElement>(null);

  const fieldErrors = result?.kind === "invalid" ? result.fieldErrors : {};
  const addOnTotal = addOns.filter((a) => selected.includes(a.id)).reduce((s, a) => s + a.priceCents, 0);
  const total = priceCents + addOnTotal;
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const attribution = () => readAttribution(slug, { src: props.src, ref: props.refCode });

  function showProblem(r: BookingResult | null, message: string | null) {
    setResult(r);
    setError(message);
    requestAnimationFrame(() => messages.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  /**
   * The whole booking: hold a spot (which also checks the address and capacity),
   * save the card with Stripe, then confirm. Returns false if anything stopped it.
   */
  async function book(who: Contact, saveCard: SaveCard): Promise<boolean> {
    const r = await prepare(slug, { ...who, notes, addOnIds: selected, smsOptIn: texts }, attribution());
    if (r.kind !== "ready") {
      showProblem(r, null);
      return false;
    }
    const saved = await saveCard(r.clientSecret, `${window.location.origin}/b/${r.token}`, who);
    if ("error" in saved) {
      showProblem(null, saved.error);
      return false;
    }
    const done = await finalize(r.token, saved.ref);
    if (!done.ok) {
      showProblem(null, done.message);
      return false;
    }
    router.push(`/b/${r.token}?new=1`);
    return true;
  }

  async function onWallet(who: Contact, saveCard: SaveCard): Promise<boolean> {
    setContact(who); // if anything goes wrong, the form is already filled in
    setBusy("wallet");
    setResult(null);
    setError(null);
    const ok = await book(who, saveCard).catch(() => (showProblem(null, "Something went wrong. Please try again."), false));
    if (!ok) setBusy(null);
    return ok;
  }

  async function onMockWallet() {
    const who = await mockWalletIdentity(slug);
    if (!who) return showProblem(null, "No free addresses left for the test wallet.");
    await onWallet(who, async () => ({ ref: "pm_mock_ok" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    setSide(null);
    const driver = card.current;
    if (!driver) return showProblem(null, "The card field is still loading. Try again in a second.");
    setBusy("card");
    try {
      const cardProblem = await driver.validate();
      if (cardProblem) return showProblem(null, cardProblem);
      if (!(await book(contact, driver.save))) return;
      return; // navigating away
    } catch {
      showProblem(null, "Something went wrong. Please try again.");
    } finally {
      setBusy((b) => (b === "card" ? null : b));
    }
  }

  function requestReview() {
    startSide(async () => {
      const r = await submitReview(slug, contact);
      setSide({ kind: "review", ok: r.ok, message: r.ok ? undefined : r.message });
    });
  }

  function joinWaitlist(e?: React.FormEvent) {
    e?.preventDefault();
    const a = attribution();
    startSide(async () => {
      const r = await submitWaitlist(slug, contact, a.src, a.ref);
      setSide({ kind: "waitlist", ok: r.ok, message: r.ok ? undefined : r.message });
    });
  }

  if (side?.ok) {
    return (
      <div className="animate-rise py-2 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-leaf-100 text-leaf-600">
          <Icon name="check" className="size-6" />
        </div>
        <h3 className="mt-3 text-xl font-bold">{side.kind === "review" ? "Thanks, we're checking" : "You're on the waitlist"}</h3>
        <p className="mt-1.5 text-muted">
          {side.kind === "review" ? `We'll confirm your address with ${communityName} and email ${contact.email} soon.` : `If a spot opens before signups close, we'll email ${contact.email} right away.`}
        </p>
      </div>
    );
  }

  const nameEmailPhone = (
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
    </>
  );
  const address = (
    <div className="grid grid-cols-[1fr_6.5rem] gap-3">
      <Field label="Street address" htmlFor="street" error={fieldErrors.street}>
        <AddressInput
          slug={slug}
          value={contact.street}
          invalid={!!fieldErrors.street || result?.kind === "not_on_list"}
          onChange={(street) => {
            setContact((c) => ({ ...c, street }));
            if (result?.kind === "not_on_list") setResult(null);
          }}
        />
      </Field>
      <Field label="Unit" htmlFor="unit">
        <Input id="unit" name="unit" autoComplete="address-line2" placeholder="Optional" value={contact.unit} onChange={set("unit")} />
      </Field>
    </div>
  );

  if (mode === "waitlist") {
    return (
      <form onSubmit={joinWaitlist} className="space-y-4">
        <Notice tone="warn" title="This service day is full">
          {vendorName} has booked every spot they can handle. Join the waitlist and we&apos;ll email you if one opens.
        </Notice>
        {nameEmailPhone}
        {address}
        {side && !side.ok ? <Notice tone="error">{side.message}</Notice> : null}
        <Button type="submit" size="lg" className="w-full" disabled={sidePending}>
          {sidePending ? "Joining…" : "Join the waitlist"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {addOns.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Add to the same visit <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="space-y-2">
            {addOns.map((a) => {
              const on = selected.includes(a.id);
              return (
                <label key={a.id} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition", on ? "border-navy-600 bg-navy-100/50" : "border-line bg-white hover:border-stone-300")}>
                  <input type="checkbox" checked={on} onChange={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))} className="mt-0.5 size-5 shrink-0 accent-navy-700" />
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

      <TextOptIn checked={texts} onChange={setTexts} />

      {/* Fastest path: the phone's wallet supplies name, email, phone, address and card. */}
      <div className={cx(busy === "card" && "pointer-events-none opacity-50")}>
        {payments.mode === "stripe" ? (
          <StripeWallet publishableKey={payments.publishableKey} onDetails={onWallet} onAvailability={setWalletShown} />
        ) : (
          <MockWallet onClick={onMockWallet} busy={busy === "wallet"} />
        )}
      </div>
      {walletShown ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-px flex-1 bg-line" />
          or enter your details
          <span className="h-px flex-1 bg-line" />
        </div>
      ) : null}

      <div ref={messages} className="space-y-3 empty:hidden">
        {result?.kind === "not_on_list" ? (
          <Notice tone="warn" title={`We couldn't find ${contact.street || "that address"} on ${communityName}'s list`} className="animate-rise">
            <p>Pick your address from the suggestions as you type. Still not there? We&apos;ll check it for you.</p>
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
        {result?.kind === "invalid" && busy === null && Object.keys(fieldErrors).length ? <Notice tone="error">Check the highlighted fields below.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>

      <div className="space-y-4">
        {nameEmailPhone}
        {address}
        {showNotes || notes ? (
          <Field label={<>Notes for the crew <span className="font-normal text-muted">(optional)</span></>} htmlFor="notes">
            <Textarea id="notes" rows={2} className="min-h-0" placeholder="Gate code, dog in the yard, side gate on the left…" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus={showNotes && !notes} />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-semibold text-navy-700">
            + Add a note for the crew
          </button>
        )}
        <Field label="Card" htmlFor="card">
          {payments.mode === "stripe" ? <StripeCard publishableKey={payments.publishableKey} register={registerCard} /> : <MockCard register={registerCard} />}
        </Field>
      </div>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
          {busy === "card" ? "Booking…" : busy === "wallet" ? "Finishing with your wallet…" : `Book for ${formatCents(total)}`}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted">
          You won&apos;t be charged today. By booking, you agree to the{" "}
          <Link href={`/d/${slug}/terms`} target="_blank" className="font-semibold text-navy-700 underline underline-offset-2">
            booking terms
          </Link>{" "}
          and authorize Pavilion to charge your card the final group price after {vendorName} finishes the job.
        </p>
      </div>
    </form>
  );
}

/** Consent for service-day texts. Sits above the wallet button so it covers both ways of booking. */
function TextOptIn({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3">
      <input type="checkbox" name="smsOptIn" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy-700" />
      <span className="text-sm">
        <span className="block font-semibold">Text me when the crew is on the way</span>
        <span className="block text-muted">Plus your confirmation, a reminder the day before, and any date or payment updates. No marketing texts. Usually 2–5 texts per service. Msg &amp; data rates may apply. Reply STOP to opt out.</span>
      </span>
    </label>
  );
}
