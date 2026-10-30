"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const links = [
  { href: "/admin", label: "Deals", match: (p: string) => p === "/admin" || p.startsWith("/admin/deals") },
  { href: "/admin/communities", label: "Communities", match: (p: string) => p.startsWith("/admin/communities") },
  { href: "/admin/vendors", label: "Vendors", match: (p: string) => p.startsWith("/admin/vendors") },
  { href: "/admin/outbox", label: "Outbox", match: (p: string) => p.startsWith("/admin/outbox") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-5">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cx("border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition", l.match(pathname) ? "border-pine-700 text-pine-800" : "border-transparent text-muted hover:text-ink")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
