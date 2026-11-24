import type { ElectionStatus } from "@/types";

export const STATUS_META: Record<
  ElectionStatus,
  { label: string; chipClass: string; dotClass: string }
> = {
  draft: {
    label: "Draft",
    chipClass: "bg-surface-container-high text-on-surface-variant",
    dotClass: "bg-outline",
  },
  active: {
    label: "Voting live",
    chipClass: "bg-primary-container text-on-primary-container",
    dotClass: "bg-primary",
  },
  closed: {
    label: "Voting closed",
    chipClass: "bg-secondary-container text-on-secondary-container",
    dotClass: "bg-on-secondary-container",
  },
};

export const CLASS_OPTIONS = [
  "Form 1 — Science",
  "Form 1 — Arts",
  "Form 1 — Business",
  "Form 1 — Technical",
  "Form 2 — Science",
  "Form 2 — Arts",
  "Form 2 — Business",
  "Form 2 — Technical",
  "Form 3 — Science",
  "Form 3 — Arts",
  "Form 3 — Business",
  "Form 3 — Technical",
];

