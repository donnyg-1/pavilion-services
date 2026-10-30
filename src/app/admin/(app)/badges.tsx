import { Badge } from "@/components/ui";

export function statusBadge(status: string, window?: string) {
  if (status === "open" && window === "closed") return <Badge tone="honey">Signups closed</Badge>;
  const map: Record<string, [string, "green" | "neutral" | "honey" | "blue"]> = {
    open: ["Open", "green"],
    draft: ["Draft", "neutral"],
    completed: ["Completed", "blue"],
    archived: ["Archived", "neutral"],
  };
  const [label, tone] = map[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

const BOOKING_TONES: Record<string, "green" | "neutral" | "honey" | "blue" | "red"> = {
  pending_setup: "honey",
  booked: "green",
  completed: "blue",
  charged: "blue",
  failed: "red",
  refunded: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

const BOOKING_LABELS: Record<string, string> = {
  pending_setup: "Saving card",
  booked: "Booked",
  completed: "Charging",
  charged: "Charged",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
  expired: "Abandoned",
};

export function bookingBadge(status: string) {
  return <Badge tone={BOOKING_TONES[status] ?? "neutral"}>{BOOKING_LABELS[status] ?? status}</Badge>;
}
