"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { setTexts } from "./actions";

/** On/off switch for service-day texts, for people who booked with a wallet or changed their mind. */
export function TextsToggle({ token, initial, phone }: { token: string; initial: boolean; phone: string }) {
  const [on, setOn] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span>
      <span>{on ? `On, to ${phone}` : "Off"} </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setTexts(token, !on);
            if (r.ok) setOn(!on);
            setMessage(r.message);
          })
        }
        className="font-semibold text-navy-700 disabled:opacity-50"
      >
        {on ? "Turn off" : "Text me reminders"}
      </button>
      {message ? <span className="block text-sm text-navy-700">{message}</span> : null}
    </span>
  );
}

/**
 * Asked right after booking instead of on the booking form, so the form stays short.
 * The disclosure sits next to the button because this tap is the resident's consent.
 */
export function TextsPrompt({ token, initial, phone }: { token: string; initial: boolean; phone: string }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (on) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-leaf-100/60 px-4 py-3.5 text-[15px]" data-testid="texts-prompt">
        <span className="font-semibold text-leaf-600">✓</span>
        <span>
          Texts are on. We&apos;ll text {phone} when the crew is on the way.
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4" data-testid="texts-prompt">
      <p className="font-semibold">Want a text when the crew&apos;s on the way?</p>
      <p className="mt-1 text-sm text-muted">
        To {phone}. Plus a reminder the day before and any date or payment updates. No marketing. Usually 2–5 texts per service. Msg &amp; data rates may apply. Reply STOP to opt out.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setTexts(token, true);
            if (r.ok) setOn(true);
            else setError(r.message);
          })
        }
        className={buttonClass("primary", "md", "mt-3 w-full")}
      >
        {pending ? "Turning on…" : "Yes, text me"}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
