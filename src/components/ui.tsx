import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-pine-700" />
      <path d="M6.5 13.2 16 7l9.5 6.2" fill="none" stroke="#eef2ea" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 14.5h14" stroke="#a3b78f" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 17v7.5M16 17v7.5M21 17v7.5" stroke="#eef2ea" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-pine-800">
      <LogoMark />
      <span>Pavilion</span>
      {suffix ? <span className="ml-1 font-sans text-sm font-medium tracking-normal text-muted">{suffix}</span> : null}
    </Link>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-pine-700 text-white hover:bg-pine-800 active:bg-pine-900 shadow-sm shadow-pine-900/10",
  secondary: "bg-white text-pine-800 border border-line hover:border-sage-300 hover:bg-sage-50",
  ghost: "text-pine-700 hover:bg-sage-100",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-50",
  light: "bg-sage-100 text-pine-800 hover:bg-sage-200",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-6 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-white", className)} {...props} />;
}

type BadgeTone = "neutral" | "green" | "honey" | "red" | "blue";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-sage-100 text-muted",
  green: "bg-pine-100 text-pine-800",
  honey: "bg-honey-50 text-[#8a6418]",
  red: "bg-danger-50 text-danger",
  blue: "bg-[#e8eff7] text-[#2c5282]",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("mb-1.5 block text-sm font-semibold text-ink", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="mt-1.5 text-sm font-medium text-danger">{error}</p> : hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx("input-base", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx("input-base min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx("input-base appearance-none bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1.5 6 6.5l5-5' fill='none' stroke='%235b6b62' stroke-width='1.6'/></svg>\")] bg-[length:12px_8px] bg-[right_14px_center] bg-no-repeat pr-10", className)} {...props} />;
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warn" | "error"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: "bg-sage-100 border-sage-200 text-ink",
    success: "bg-pine-100 border-pine-600/20 text-pine-900",
    warn: "bg-honey-50 border-honey/30 text-[#5f4512]",
    error: "bg-danger-50 border-danger/25 text-[#7a2a1e]",
  }[tone];
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-[15px]", styles, className)} role={tone === "error" ? "alert" : undefined}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cx(title ? "mt-0.5" : null, "leading-relaxed")}>{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white p-4", className)}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export function Icon({ name, className = "size-5" }: { name: "check" | "calendar" | "home" | "clock" | "leaf" | "shield" | "card" | "users" | "arrow" | "share" | "copy" | "x" | "truck" | "mail" | "star"; className?: string }) {
  const paths: Record<string, ReactNode> = {
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    home: <path d="M4 11 12 4.5 20 11M6.5 9.5V19.5h11V9.5M10 19.5v-5h4v5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    leaf: <path d="M5 19c0-8 5-13.5 14-14 .5 9-5 14-12 14H5Zm0 0 7-7" />,
    shield: <path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-2.5Zm-3 8.5 2.2 2.2L15.5 10" />,
    card: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.3c1.6.6 2.7 2.2 3 4.7" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    share: <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />,
    copy: (
      <>
        <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
        <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
      </>
    ),
    x: <path d="m6.5 6.5 11 11m0-11-11 11" />,
    truck: <path d="M3.5 6.5h10v9h-10zM13.5 10h4l3 3v2.5h-7M7 18.5a1.75 1.75 0 1 0 0-.01M17 18.5a1.75 1.75 0 1 0 0-.01" />,
    mail: (
      <>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
