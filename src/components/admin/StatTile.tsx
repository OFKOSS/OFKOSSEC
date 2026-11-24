import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  accent?: "poppy" | "cobalt" | "mustard" | "ink";
}

const ACCENTS: Record<NonNullable<StatTileProps["accent"]>, string> = {
  poppy: "bg-primary-container text-on-primary-container",
  cobalt: "bg-tertiary-container text-on-tertiary-container",
  mustard: "bg-surface-container-highest text-on-surface",
  ink: "bg-secondary-container text-on-secondary-container",
};

export function StatTile({ label, value, hint, icon, accent = "ink" }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 shadow-elev-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.5px] text-on-surface-variant">{label}</p>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            ACCENTS[accent],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-4xl font-normal leading-none text-on-surface">{value}</p>
      {hint && <p className="mt-2 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
