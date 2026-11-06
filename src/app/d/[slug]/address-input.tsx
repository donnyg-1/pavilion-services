"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, Input, cx } from "@/components/ui";

export type AddressStatus = "idle" | "on_list" | "not_on_list";

/**
 * Street address field that suggests matches from the community's address list as you
 * type, and says whether the address is on the list as soon as it's picked or the
 * resident moves on, instead of after they press Book.
 */
export function AddressInput({ slug, value, onChange, invalid, onStatus, prefilled }: { slug: string; value: string; onChange: (v: string) => void; invalid: boolean; onStatus?: (s: AddressStatus) => void; prefilled?: boolean }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A prefilled address came from the community list, so it counts as picked: no suggestions.
  const picked = useRef<string | null>(prefilled ? value : null);
  const checking = useRef("");
  const listId = useId();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || !/^\d/.test(q) || picked.current === value) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/addresses?deal=${encodeURIComponent(slug)}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { suggestions: string[] };
        setSuggestions(data.suggestions);
        setActive(-1);
        setOpen(true);
      } catch {
        // aborted or offline: typing still works without suggestions
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, slug]);

  function pick(s: string) {
    picked.current = s;
    onChange(s);
    onStatus?.("on_list");
    setSuggestions([]);
    setOpen(false);
  }

  async function check() {
    const q = value.trim();
    if (picked.current === value || !/^\d+\s+\S/.test(q)) return;
    try {
      const res = await fetch(`/api/addresses?deal=${encodeURIComponent(slug)}&check=1&q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { onList: boolean | null };
      if (data.onList !== null && checking.current === q) onStatus?.(data.onList ? "on_list" : "not_on_list");
    } catch {
      // offline: the server still checks when they press Book
    }
  }

  const showList = open && suggestions.length > 0;
  return (
    <div className="relative">
      <Input
        id="street"
        name="street"
        autoComplete="address-line1"
        placeholder="Start with your house number"
        required
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        onChange={(e) => {
          picked.current = null;
          checking.current = "";
          onStatus?.("idle");
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            checking.current = value.trim();
            void check();
          }, 150)
        }
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg shadow-navy-900/10">
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className={cx("flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-[15px]", i === active ? "bg-stone-100" : "hover:bg-stone-50")}
            >
              <Icon name="home" className="size-4 shrink-0 text-navy-600" />
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
