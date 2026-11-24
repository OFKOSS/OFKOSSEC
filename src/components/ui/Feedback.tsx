import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} strokeWidth={2.4} />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm font-medium text-on-surface-variant">
      <Spinner className="h-5 w-5 text-primary" />
      {label}
    </div>
  );
}

type Tone = "error" | "info" | "success";

const TONES: Record<Tone, string> = {
  error: "bg-error-container text-on-error-container",
  info: "bg-tertiary-container text-on-tertiary-container",
  success: "bg-success-container text-on-success-container",
};

export function Alert({ tone = "error", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium",
        TONES[tone],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        {icon}
      </div>
      <h3 className="text-xl font-medium text-on-surface">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-on-surface-variant">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
