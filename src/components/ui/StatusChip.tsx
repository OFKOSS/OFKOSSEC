import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/constants";
import type { ElectionStatus } from "@/types";

interface StatusChipProps {
  status: ElectionStatus;
  resultsPublic?: boolean;
  className?: string;
}

/** Material 3 assist chip describing an election's state. */
export function StatusChip({ status, resultsPublic = false, className }: StatusChipProps) {
  const showResults = status !== "active" && resultsPublic;
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.3px]",
        showResults ? "bg-tertiary-container text-on-tertiary-container" : meta.chipClass,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          showResults ? "bg-on-tertiary-container" : meta.dotClass,
          status === "active" && !showResults && "animate-pulse",
        )}
      />
      {showResults ? "Results out" : meta.label}
    </span>
  );
}

export function RoleChip({ role, className }: { role: "student" | "admin"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.3px]",
        role === "admin"
          ? "bg-primary text-on-primary"
          : "bg-surface-container-high text-on-surface-variant",
        className,
      )}
    >
      {role === "admin" ? "Electoral officer" : "Student"}
    </span>
  );
}
