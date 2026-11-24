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

/**
 * The school's class list. The class name is also the voter's password, so
 * these strings are matched exactly on import and must stay in this order.
 */
export const CLASS_OPTIONS = [
  "3A1",
  "3A2",
  "3A3",
  "3A4",
  "3B",
  "3C1",
  "3C2",
  "3GS",
  "3V",
  "2A1",
  "2A2",
  "2A3",
  "2A4",
  "2B",
  "2C1",
  "2C2",
  "2GS",
  "2V",
];

