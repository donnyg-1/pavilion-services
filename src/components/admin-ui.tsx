"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx, Icon } from "./ui";

export type ActionResult = { ok: boolean; message: string } | null;
type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** A form bound to a server action that shows the action's result message inline. */
export function ActionForm({ action, children, className, confirm, inline, id, silent }: { action: Action; children: ReactNode; className?: string; confirm?: string; inline?: boolean; id?: string; /** result is shown elsewhere (flash banner) */ silent?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      id={id}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={className}
    >
      {children}
      {state?.message && !silent ? (
        <p className={cx("text-sm font-medium", inline ? "mt-1" : "mt-2", state.ok ? "text-navy-700" : "text-danger")} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({ children, pendingText, variant = "primary", size = "sm", className, form, name, value }: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" | "ghost" | "danger" | "light"; size?: "sm" | "md" | "lg"; className?: string; form?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)} form={form} name={name} value={value}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white py-1.5 pr-1.5 pl-3">
      {label ? <span className="w-20 shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">{label}</span> : null}
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{value}</span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => window.prompt("Copy", value));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-stone-100 px-2.5 text-xs font-semibold text-navy-800 hover:bg-stone-200"
      >
        <Icon name={copied ? "check" : "copy"} className="size-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function SelectAll({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="size-4 accent-navy-700"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${formId}"]`).forEach((c) => {
          if (!c.disabled) c.checked = e.target.checked;
        });
      }}
    />
  );
}
