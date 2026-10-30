import { formatCents } from "@/lib/domain/money";
import { cx, Icon } from "./ui";

type Props = {
  tiers: { minHomes: number; priceCents: number }[];
  confirmed: number;
  currentTierMinHomes: number;
  next: { homesNeeded: number; priceCents: number; minHomes: number } | null;
  locked: boolean;
  compact?: boolean;
};

export function TierProgress({ tiers, confirmed, currentTierMinHomes, next, locked }: Props) {
  const top = tiers[tiers.length - 1]?.minHomes ?? 1;
  // Fill the bar between the current tier and the next one; full at the lowest price.
  const pct = next ? Math.min(100, Math.max(4, ((confirmed - currentTierMinHomes) / Math.max(1, next.minHomes - currentTierMinHomes)) * 100)) : 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-ink">
          <span className="font-display text-lg">{confirmed}</span> {confirmed === 1 ? "home" : "homes"} booked
        </p>
        {locked ? (
          <p className="font-medium text-muted">Price locked</p>
        ) : next ? (
          <p className="font-semibold text-pine-700">
            {next.homesNeeded} more → {formatCents(next.priceCents)}
          </p>
        ) : (
          <p className="font-semibold text-pine-700">Lowest price unlocked</p>
        )}
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sage-100" role="progressbar" aria-valuemin={0} aria-valuemax={top} aria-valuenow={confirmed} aria-label="Progress to the next price">
        <div className="h-full rounded-full bg-gradient-to-r from-pine-600 to-pine-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TierLadder({ tiers, currentTierMinHomes, compact }: Props) {
  return (
    <ol className={cx("divide-y divide-line overflow-hidden rounded-xl border border-line", compact ? "text-sm" : "text-[15px]")}>
      {tiers.map((t) => {
        const unlocked = t.minHomes <= currentTierMinHomes;
        const current = t.minHomes === currentTierMinHomes;
        return (
          <li key={t.minHomes} className={cx("flex items-center gap-3 px-3.5 py-2.5", current ? "bg-pine-100/70" : "bg-white")}>
            <span className={cx("grid size-6 shrink-0 place-items-center rounded-full", unlocked ? "bg-pine-700 text-white" : "border border-sage-300 bg-white text-sage-400")}>
              {unlocked ? <Icon name="check" className="size-3.5" /> : <span className="size-1.5 rounded-full bg-sage-300" />}
            </span>
            <span className={cx("flex-1", unlocked ? "text-ink" : "text-muted")}>{t.minHomes <= 1 ? "Starting price" : `${t.minHomes}+ homes`}</span>
            {current ? <span className="rounded-full bg-pine-700 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">Now</span> : null}
            <span className={cx("w-16 text-right font-display font-bold", unlocked ? "text-ink" : "text-muted")}>{formatCents(t.priceCents)}</span>
          </li>
        );
      })}
    </ol>
  );
}
