import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, ScrollText, Trash2, Vote } from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { formatDateTime, pluralise, statusLabel } from "@/utils/format";
import type { AuditLogEntry, ElectionStatus } from "@/types";

/** How long a removed election stays listed on this page. */
const WINDOW_DAYS = 10;

interface DeletedElection {
  id: number;
  createdAt: string;
  actorLabel: string;
  title: string;
  position: string | null;
  status: ElectionStatus | null;
}

/** The prior row that record_audit() keeps on a delete. */
function removedRow(details: AuditLogEntry["details"]): Record<string, unknown> {
  const removed = details?.removed;
  return removed && typeof removed === "object" ? (removed as Record<string, unknown>) : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Elections removed in the last ten days.
 *
 * Deleting an election takes its candidates with it and cannot be undone, so the
 * only record that it ever existed is the copy the audit trigger keeps in
 * public.audit_log. This page reads those delete rows back out — what the
 * election was, who removed it and when — before they age out of the window.
 */
export default function DeletedElections() {
  const [rows, setRows] = useState<DeletedElection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: loadError } = await supabase
      .from("audit_log")
      .select("*")
      .eq("entity", "election")
      .eq("action", "election.delete")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setRows([]);
    } else {
      setRows(
        ((data as AuditLogEntry[]) ?? []).map((entry) => {
          const removed = removedRow(entry.details);
          const status = asText(removed.status);
          return {
            id: entry.id,
            createdAt: entry.created_at,
            actorLabel: entry.actor_label,
            title: asText(removed.title) ?? entry.label,
            position: asText(removed.position),
            status: status === "draft" || status === "active" || status === "closed" ? status : null,
          };
        }),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            title="Deleted elections"
            description={`Elections removed in the last ${WINDOW_DAYS} days — what they were, who removed them and when.`}
            actions={
              <Button
                variant="outline"
                size="md"
                onClick={() => void load()}
                disabled={loading}
                icon={
                  <RefreshCw
                    className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                    strokeWidth={2.4}
                  />
                }
              >
                Refresh
              </Button>
            }
          />
        </div>

        {error && (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        )}

        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-variant pb-4">
            <h2 className="text-2xl font-normal text-on-surface">
              {loading ? "Reading the record…" : `Removed in the last ${WINDOW_DAYS} days`}
            </h2>
            {!loading && (
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                {pluralise(rows.length, "election")}
              </span>
            )}
          </div>

          {loading ? (
            <PageLoader label="Reading the record" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Trash2 className="h-6 w-6" strokeWidth={2.2} />}
              title={`No elections removed in the last ${WINDOW_DAYS} days`}
              description="Deleting an election from its Manage page will list it here, with the officer who removed it."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-elev-1 sm:p-5"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
                      <Vote className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-sm font-medium text-on-surface">{row.title}</p>
                        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                          {formatDateTime(row.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-on-surface-variant">
                        {row.position ?? "No position recorded"}
                        {row.status && (
                          <>
                            <span className="mx-2 opacity-50">·</span>
                            <span className="line-through opacity-70">{statusLabel(row.status)}</span>
                          </>
                        )}
                      </p>

                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
                        <span>Removed by</span>
                        <span className="font-mono">{row.actorLabel}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
          <ScrollText className="h-4 w-4" strokeWidth={2.2} />
          Older removals stay in the
          <Link to="/admin/audit" className="text-primary transition-colors hover:text-on-surface">
            audit trail
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
