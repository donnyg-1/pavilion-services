"use client";

import { useState, useTransition } from "react";
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
