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
 * these strings are matched exactly on import.
 *
 * Officers now manage the live list in the database (public.classes, migration
 * 013) and can rename, add and remove classes there. This array is the seed for
 * that table and the fallback the app falls back on when the list cannot be
 * read — see src/hooks/useClasses.ts.
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

/**
 * The school's house list, the same idea as CLASS_OPTIONS. Houses are the
 * boarding houses a student belongs to, and a ballot can be opened to one house
 * only — a house prefect is chosen by that house (migration 019).
 *
 * Officers manage the live list in the database (public.houses) and rename the
 * placeholders there. This array is the seed for that table and the fallback
 * when the list cannot be read — see src/hooks/useHouses.ts.
 */
export const HOUSE_OPTIONS = ["House 1", "House 2", "House 3", "House 4"];

