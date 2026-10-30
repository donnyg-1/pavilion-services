"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { formatCents } from "@/lib/domain/money";

type Referral = { enabled: boolean; referrals: number; earnedCents: number; perCents: number; capCents: number; left: number };

export function ShareBox({ url, title, communityName, priceCents, next, referral }: { url: string; title: string; communityName: string; priceCents: number; next: { homesNeeded: number; priceCents: number } | null; referral: Referral }) {
  const [copied, setCopied] = useState(false);
  const message = next
    ? `I just booked ${title} for ${formatCents(priceCents)} (normally more). ${next.homesNeeded} more ${communityName} homes and it drops to ${formatCents(next.priceCents)} for all of us. Book here: ${url}`
    : `I just booked ${title} for ${communityName} at the lowest group price (${formatCents(priceCents)}). Book here: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: message });
      } catch {
        // dismissed
      }
    } else {
      copy();
    }
  }

  return (
    <div className="rounded-2xl bg-pine-800 p-5 text-white">
      {referral.enabled ? (
        <>
          <p className="font-display text-xl font-bold">Get {formatCents(referral.perCents)} off for every neighbor who books</p>
          <p className="mt-1 text-sage-200">
            Share your link. Each neighbor who books with it takes {formatCents(referral.perCents)} off your job, up to {formatCents(referral.capCents)}.
            {next ? ` And ${next.homesNeeded} more ${next.homesNeeded === 1 ? "home" : "homes"} drops the price to ${formatCents(next.priceCents)} for everyone.` : ""}
          </p>
          <ReferralMeter referral={referral} />
        </>
      ) : (
        <>
          <p className="font-display text-xl font-bold">Lower the price for everyone</p>
          <p className="mt-1 text-sage-200">
            {next ? `${next.homesNeeded} more ${next.homesNeeded === 1 ? "home" : "homes"} and the price drops to ${formatCents(next.priceCents)}, for you too.` : "Every neighbor who books makes the service day better for the crew and the community."}
          </p>
        </>
      )}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm text-sage-100" data-testid="share-url">{url}</span>
        <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-pine-800">
          <Icon name={copied ? "check" : "copy"} className="size-4" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="light" onClick={share}>
          <Icon name="share" className="size-4.5" /> Share
        </Button>
        <a href={`sms:?&body=${encodeURIComponent(message)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-sage-100 text-[15px] font-semibold text-pine-800 hover:bg-sage-200">
          <Icon name="mail" className="size-4.5" /> Text a neighbor
        </a>
      </div>
    </div>
  );
}

/** One slot per creditable referral, filled as neighbors book. */
function ReferralMeter({ referral }: { referral: Referral }) {
  const slots = Math.max(1, Math.ceil(referral.capCents / referral.perCents));
  const filled = Math.min(referral.referrals, slots);
  return (
    <div className="mt-4 rounded-xl bg-white/10 p-3" data-testid="referral-meter">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{referral.earnedCents ? `You've earned ${formatCents(referral.earnedCents)} off` : "No neighbors yet"}</span>
        <span className="text-sage-300">{referral.left ? `${referral.left} more to max out` : "Maxed out. Thank you!"}</span>
      </div>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={i < filled ? "h-2 rounded-full bg-sage-300" : "h-2 rounded-full bg-white/15"} />
        ))}
      </div>
    </div>
  );
}
