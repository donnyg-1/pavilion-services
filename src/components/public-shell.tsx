import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

export function PublicHeader({ community }: { community?: string }) {
  return (
    <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
      <Logo href="#" />
      {community ? <span className="rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-muted">{community}</span> : null}
    </header>
  );
}

export function PublicFooter({ termsHref, children }: { termsHref?: string; children?: ReactNode }) {
  return (
    <footer className="mx-auto max-w-2xl px-4 pt-6 pb-28 text-sm text-muted sm:px-6 sm:pb-12">
      {children}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-5">
        <span className="font-display font-bold text-pine-800">Pavilion</span>
        <span>Home services for HOA communities in Utah County</span>
        {termsHref ? (
          <Link href={termsHref} className="font-medium text-pine-700 underline-offset-2 hover:underline">
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
