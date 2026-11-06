"use client";

import { useState, useTransition } from "react";
import { Icon, buttonClass } from "@/components/ui";
import { saveSpot } from "./actions";

/**
 * Shown after the job, on the booking page and after a rating: the moment people are
 * happiest with the service. Saving records interest only; they confirm next time.
 */
export function SaveMySpot({ token, initial, title, email }: { token: string; initial: boolean; title: string; email: string }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (v: boolean) =>
    start(async () => {
      const r = await saveSpot(token, v);
      if (r.ok) setOn(v);
      setError(r.ok ? null : r.message);
    });

  return (
    <div id="next-time" className="scroll-mt-4 rounded-3xl bg-stone-100 p-5" data-testid="save-my-spot">
      {on ? (
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf-100 text-leaf-600">
            <Icon name="check" className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Your spot is saved for next time</p>
            <p className="mt-0.5 text-sm text-muted">
              We&apos;ll email {email} as soon as the next {title} is scheduled, with your details already filled in. Nothing is booked or charged until you confirm.
            </p>
            <button type="button" disabled={pending} onClick={() => set(false)} className="mt-2 text-sm font-semibold text-navy-700 disabled:opacity-50">
              Never mind
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-display text-xl font-bold">Want this again next time?</p>
          <p className="mt-1 text-sm text-muted">Save your spot and we&apos;ll email you as soon as the next {title} is scheduled. Nothing is booked or charged until you confirm.</p>
          <button type="button" disabled={pending} onClick={() => set(true)} className={buttonClass("primary", "md", "mt-4 w-full")}>
            {pending ? "Saving…" : "Save my spot for next time"}
          </button>
        </>
      )}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
