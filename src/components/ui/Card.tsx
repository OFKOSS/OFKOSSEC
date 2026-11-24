import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Adds the Material elevation-1 treatment used across the app. */
  raised?: boolean;
}

export function Card({ className, children, raised = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-outline-variant bg-surface-container-low",
        raised && "shadow-elev-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
