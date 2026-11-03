import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

export function PublicHeader({ community }: { community?: string }) {
  return (
    <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
      <Logo href="#" />
      {community ? <span className="rounded-xl bg-stone-100 px-3.5 py-2 text-sm font-medium text-ink">{community}</span> : null}
    </header>
  );
}

export function PublicFooter({ termsHref, children }: { termsHref?: string; children?: ReactNode }) {
  return (
    <footer className="mx-auto max-w-2xl px-4 pt-6 pb-28 text-sm text-muted sm:px-6 sm:pb-12">
      {children}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-5">
        <span className="font-display text-lg font-bold text-ink">Pavilion</span>
        <span>Home services for HOA communities in Utah County</span>
        {termsHref ? (
          <Link href={termsHref} className="font-medium text-navy-700 underline-offset-2 hover:underline">
            Booking terms
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed">
        Pavilion is the booking platform. The service company performs the work. No app or account needed.
      </p>
    </footer>
  );
}
