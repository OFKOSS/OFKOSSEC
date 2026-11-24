import type { Election, ElectionStatus } from "@/types";

const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", DATE_TIME);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "3 days left" / "Closed 2 days ago" style copy for election deadlines. */
export function describeDeadline(election: Pick<Election, "status" | "ends_at">): string {
  if (!election.ends_at) return "No deadline set";
  const end = new Date(election.ends_at).getTime();
  if (Number.isNaN(end)) return "No deadline set";

  const diff = end - Date.now();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor(abs / 3_600_000);
  const unit =
    days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.max(hours, 1)} hour${hours === 1 ? "" : "s"}`;

  if (election.status === "closed" || diff < 0) return `Closed ${unit} ago`;
  return `${unit} left`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Formats an ISO string for a `datetime-local` input. */
export function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function statusLabel(status: ElectionStatus): string {
  if (status === "active") return "Voting live";
  if (status === "closed") return "Voting closed";
  return "Draft";
}
