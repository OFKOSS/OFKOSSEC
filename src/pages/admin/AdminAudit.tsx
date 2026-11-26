import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  History,
  IdCard,
  RefreshCw,
  Search,
  UserRound,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { useAuditLog } from "@/hooks/useAuditLog";
import { formatDateTime, pluralise } from "@/utils/format";
import type { AuditLogEntry } from "@/types";

/** How each kind of row is named and drawn in the log. */
const ENTITY_META: Record<string, { noun: string; icon: LucideIcon }> = {
  voter: { noun: "voter", icon: IdCard },
  class: { noun: "class", icon: GraduationCap },
  election: { noun: "election", icon: Vote },
  candidate: { noun: "candidate", icon: UserRound },
};

const VERB: Record<string, string> = { create: "Added", update: "Updated", delete: "Removed" };

interface AuditGroup {
  key: string;
  createdAt: string;
  actorLabel: string;
  action: string;
  entity: string;
  entries: AuditLogEntry[];
}

/**
 * Rows written by one action share a created_at (now() is fixed per
 * transaction), so a bulk change — a class rename touching thirty voters —
 * collapses back into a single line instead of thirty.
 */
function groupEntries(entries: AuditLogEntry[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  const byKey = new Map<string, AuditGroup>();

  for (const entry of entries) {
    const key = `${entry.created_at}|${entry.actor_label}|${entry.action}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    const group: AuditGroup = {
      key,
      createdAt: entry.created_at,
      actorLabel: entry.actor_label,
      action: entry.action,
      entity: entry.entity,
      entries: [entry],
    };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Column changes as {field: {from, to}}, for an update. */
function changeList(details: AuditLogEntry["details"]) {
  if (!details) return [];
  return Object.entries(details)
    .filter(([field, value]) => field !== "removed" && value !== null && typeof value === "object")
    .map(([field, value]) => {
      const change = value as { from?: unknown; to?: unknown };
      return { field, from: displayValue(change.from), to: displayValue(change.to) };
    });
}

/** The row that went away, kept on a delete. */
function removedRow(details: AuditLogEntry["details"]): Record<string, unknown> | null {
  const removed = details?.removed;
  return removed && typeof removed === "object" ? (removed as Record<string, unknown>) : null;
}

function removedFields(row: Record<string, unknown>) {
  return Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
    .slice(0, 8)
    .map(([field, value]) => ({ field, value: displayValue(value) }));
}

function groupTitle(group: AuditGroup): string {
  const verb = VERB[group.action.split(".")[1]] ?? "Changed";
  const noun = ENTITY_META[group.entity]?.noun ?? group.entity;
  if (group.entries.length > 1) return `${verb} ${pluralise(group.entries.length, noun)}`;
  const label = group.entries[0]?.label;
  return label ? `${verb} ${noun} ${label}` : `${verb} ${noun}`;
}

function groupHasDetails(group: AuditGroup): boolean {
  return group.entries.some(
    (entry) => changeList(entry.details).length > 0 || removedRow(entry.details) !== null,
  );
}

/** Officer-only audit trail: who changed the register, the classes or the elections. */
export default function AdminAudit() {
  const [entity, setEntity] = useState("all");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const { entries, loading, error, reload } = useAuditLog(entity);

  const groups = useMemo(() => {
    const all = groupEntries(entries);
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (group) =>
        group.actorLabel.toLowerCase().includes(needle) ||
        group.entries.some((entry) =>
          [entry.label, entry.action, entry.entity].join(" ").toLowerCase().includes(needle),
        ),
    );
  }, [entries, query]);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <AppShell>
      <div className="container max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Back to control room
        </Link>

        <div className="mt-6">
          <PageHeading
            eyebrow="Officer panel"
            title="Audit trail"
            description="Every change to the register, the class list, the elections and their candidates — and who made it."
            actions={
              <Button
                variant="outline"
                size="md"
                onClick={() => void reload()}
                disabled={loading}
                icon={<RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={2.4} />}
              >
                Refresh
              </Button>
            }
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            aria-label="Filter by record type"
            name="audit-entity"
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="sm:w-56"
          >
            <option value="all">All record types</option>
            <option value="voter">Voters</option>
            <option value="class">Classes</option>
            <option value="election">Elections</option>
            <option value="candidate">Candidates</option>
          </Select>

          <div className="relative sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              strokeWidth={2.2}
            />
            <input
              id="audit-search"
              name="audit-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search who, what or which record…"
              aria-label="Search the audit trail"
              className="w-full rounded-lg border border-outline bg-transparent py-2.5 pl-9 pr-9 font-sans text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 hover:border-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-variant pb-4">
            <h2 className="text-2xl font-normal text-on-surface">Recent activity</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              {loading ? "Loading…" : `${pluralise(groups.length, "event")} shown`}
            </span>
          </div>

          {loading ? (
            <PageLoader label="Reading the audit trail" />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" strokeWidth={2.2} />}
              title={entries.length === 0 ? "Nothing recorded yet" : "No entries match"}
              description={
                entries.length === 0
                  ? "Changes to voters, classes and elections will appear here as officers make them."
                  : "Try a different record type or clear your search."
              }
              action={
                entries.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setEntity("all");
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-outline px-6 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {groups.map((group) => {
                const meta = ENTITY_META[group.entity];
                const Icon = meta?.icon ?? History;
                const hasDetails = groupHasDetails(group);
                const open = openGroups.has(group.key);

                return (
                  <li
                    key={group.key}
                    className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-elev-1 sm:p-5"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
                        <Icon className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <p className="text-sm font-medium text-on-surface">{groupTitle(group)}</p>
                          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                            {formatDateTime(group.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
                          <span className="font-mono">{group.actorLabel}</span>
                          <span className="opacity-50">·</span>
                          <span className="font-mono">{group.action}</span>
                        </p>

                        {hasDetails && (
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            aria-expanded={open}
                            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-primary transition-colors hover:text-on-surface"
                          >
                            {open ? (
                              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                            )}
                            {open ? "Hide changes" : "Show changes"}
                          </button>
                        )}

                        {open && hasDetails && (
                          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-3.5">
                            {group.entries.slice(0, 50).map((entry) => {
                              const changes = changeList(entry.details);
                              const removed = removedRow(entry.details);
                              return (
                                <div key={entry.id} className="flex flex-col gap-1">
                                  {group.entries.length > 1 && (
                                    <p className="font-mono text-[11px] text-on-surface-variant">
                                      {entry.label}
                                    </p>
                                  )}
                                  {changes.map((change) => (
                                    <p key={change.field} className="text-xs leading-relaxed text-on-surface-variant">
                                      <span className="font-medium text-on-surface">{change.field}</span>
                                      {": "}
                                      <span className="line-through opacity-70">{change.from}</span>
                                      {" → "}
                                      <span>{change.to}</span>
                                    </p>
                                  ))}
                                  {removed &&
                                    removedFields(removed).map((field) => (
                                      <p
                                        key={field.field}
                                        className="text-xs leading-relaxed text-on-surface-variant"
                                      >
                                        <span className="font-medium text-on-surface">{field.field}</span>
                                        {": "}
                                        <span className="line-through opacity-70">{field.value}</span>
                                      </p>
                                    ))}
                                </div>
                              );
                            })}
                            {group.entries.length > 50 && (
                              <p className="text-xs text-on-surface-variant">
                                … and {group.entries.length - 50} more in this change.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!loading && entries.length > 0 && (
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            <History className="h-4 w-4" strokeWidth={2.2} />
            Showing the {entries.length} most recent changes
          </p>
        )}
      </div>
    </AppShell>
  );
}
