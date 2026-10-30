"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Icon, Textarea, cx } from "@/components/ui";
import { saveRating } from "./actions";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

// The score is saved from the browser (not on GET) so email link scanners
// that prefetch every 1–5 link don't record fake ratings.
export function RatingForm({ token, initialScore, initialComment, vendorName }: { token: string; initialScore: number | null; initialComment: string; vendorName: string }) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [comment, setComment] = useState(initialComment);
  const [saved, setSaved] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  const [pending, start] = useTransition();
  const once = useRef(false);

  useEffect(() => {
    if (once.current || !initialScore) return;
    once.current = true;
    saveRating(token, initialScore).then((r) => setSaved(r.ok));
  }, [token, initialScore]);

  function pick(n: number) {
    setScore(n);
    setCommentSaved(false);
    start(async () => setSaved((await saveRating(token, n)).ok));
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            onClick={() => pick(n)}
            className={cx("grid size-14 place-items-center rounded-2xl font-display text-xl font-bold transition", score && n <= score ? "bg-pine-700 text-white" : "bg-sage-100 text-pine-800 hover:bg-sage-200")}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="h-6 text-center font-semibold text-pine-700">{score ? `${LABELS[score]}${saved ? " · saved" : ""}` : `Tap to rate ${vendorName}`}</p>
      {score ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveRating(token, score, comment);
              setCommentSaved(true);
            });
          }}
        >
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={score >= 4 ? "What did they do well? (optional)" : "What should they have done better? (optional)"} />
          <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
            {commentSaved ? (
              <>
                <Icon name="check" className="size-4.5" /> Thanks for the feedback
              </>
            ) : (
              "Send feedback"
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
