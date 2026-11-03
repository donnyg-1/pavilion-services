"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { cancelMyBooking } from "./actions";

export function CancelBooking({ token, deadline }: { token: string; deadline: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <p className="text-center text-sm text-muted">
        Plans changed?{" "}
        <button type="button" onClick={() => setConfirming(true)} className="font-semibold text-navy-700 underline underline-offset-2">
          Cancel booking
        </button>{" "}
        (free until {deadline})
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className="font-semibold">Cancel this booking?</p>
      <p className="mt-1 text-sm text-muted">Your card won&apos;t be charged. You can book again before signups close.</p>
      {error ? <Notice tone="error" className="mt-3 text-left">{error}</Notice> : null}
      <div className="mt-3 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Keep booking
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelMyBooking(token);
              if (!r.ok) setError(r.message);
            })
          }
        >
          {pending ? "Cancelling…" : "Yes, cancel"}
        </Button>
      </div>
    </div>
  );
}
