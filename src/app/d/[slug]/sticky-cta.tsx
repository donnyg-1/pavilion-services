"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

/** Mobile-only bottom bar that scrolls to the form; hides once the form is on screen. */
export function StickyCta({ label, sub }: { label: string; sub: string }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const form = document.getElementById("book");
    const hero = document.getElementById("price");
    if (!form || !hero) return;
    let formVisible = false;
    let heroVisible = true;
    const update = () => setHidden(formVisible || heroVisible);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === form) formVisible = e.isIntersecting;
        if (e.target === hero) heroVisible = e.isIntersecting;
      }
      update();
    });
    io.observe(form);
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cx("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden", hidden && "translate-y-full")}>
      <a href="#book" className="flex h-12 items-center justify-between rounded-full bg-navy-700 pr-2 pl-5 font-semibold text-white">
        <span>{label}</span>
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm">{sub}</span>
      </a>
    </div>
  );
}
