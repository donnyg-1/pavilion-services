"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/components/ui";
import { saveNotes } from "./actions";

/** Lets wallet bookers (who skip the form) leave a gate code or pet note afterwards. */
export function NotesEditor({ token, initial }: { token: string; initial: string }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <span>
        {notes ? <span className="whitespace-pre-line">{notes} </span> : null}
        <button type="button" onClick={() => setEditing(true)} className="font-semibold text-pine-700">
          {notes ? "Edit" : "Add gate code, pets, etc."}
        </button>
        {message ? <span className="block text-sm text-pine-700">{message}</span> : null}
      </span>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea id="crew-notes" rows={2} className="min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, dog in the yard, side gate on the left…" autoFocus />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveNotes(token, notes);
              setMessage(r.message);
              if (r.ok) setEditing(false);
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
