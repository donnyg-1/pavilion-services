"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { formatCents } from "@/lib/domain/money";

export function ShareBox({ url, title, communityName, priceCents, next }: { url: string; title: string; communityName: string; priceCents: number; next: { homesNeeded: number; priceCents: number } | null }) {
  const [copied, setCopied] = useState(false);
  const message = next
    ? `I just booked ${title} for ${formatCents(priceCents)}. ${next.homesNeeded} more ${communityName} homes and it drops to ${formatCents(next.priceCents)} for all of us: ${url}`
    : `I just booked ${title} for ${communityName}. We unlocked the lowest price (${formatCents(priceCents)}): ${url}`;

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
      <p className="font-display text-xl font-bold">Lower the price for everyone</p>
      <p className="mt-1 text-sage-200">
        {next ? `${next.homesNeeded} more ${next.homesNeeded === 1 ? "home" : "homes"} and the price drops to ${formatCents(next.priceCents)}, for you too.` : "Every neighbor who books makes the service day better for the crew and the community."}
      </p>
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
