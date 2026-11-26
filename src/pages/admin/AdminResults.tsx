import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { StatusChip } from "@/components/ui/StatusChip";
import { StatTile } from "@/components/admin/StatTile";
import { ResultsTally, WinnerCallout } from "@/components/results/ResultsTally";
import { useElectionDetail, useResults, useTurnout } from "@/hooks/useElections";
import { supabase } from "@/lib/supabase";
import { downloadResultsCsv, downloadResultsXlsx } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { percent, pluralise } from "@/utils/format";
import type { Election } from "@/types";

export default function AdminResults() {
  const { id } = useParams<{ id: string }>();
  const { election: loadedElection, loading: electionLoading } = useElectionDetail(id);
  const { rows, loading, error, reload } = useResults(id);
  const { turnout, reload: reloadTurnout } = useTurnout(id, true);

  const [election, setElection] = useState<Election | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // While a contest is open the tally and turnout refresh on their own, so an
  // officer can leave this screen up and watch the count without pressing
  // Refresh. Polling stops on a closed election and while the tab is hidden.
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    if (loadedElection) setElection(loadedElection);
  }, [loadedElection]);

  const refreshAll = useCallback(async () => {
    await Promise.all([reload(), reloadTurnout()]);
    setLastUpdated(Date.now());
  }, [reload, reloadTurnout]);

  useEffect(() => {
    if (!live || election?.status !== "active") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshAll();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [live, election?.status, refreshAll]);

  useEffect(() => {
    if (!electionLoading && !loading && lastUpdated === null) setLastUpdated(Date.now());
  }, [electionLoading, loading, lastUpdated]);

  const patchElection = async (patch: Partial<Election>) => {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const { data, error: patchError } = await supabase
      .from("elections")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (patchError) {
      setActionError(patchError.message);
    } else {
      setElection(data as Election);
    }
    setBusy(false);
    void refreshAll();
  };

  const totalVotes = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.vote_count), 0),
    [rows],
  );
  const exportMeta = useMemo(
    () => ({
      title: election?.title ?? "Election",
      position: election?.position ?? "",
      status: election?.status ?? "closed",
      voted: turnout?.voted ?? totalVotes,
      eligible: turnout?.eligible ?? 0,
    }),
    [election, turnout, totalVotes],
  );
  const topCount = rows.length ? Math.max(...rows.map((row) => Number(row.vote_count))) : 0;
  const leaders = rows.filter((row) => Number(row.vote_count) === topCount && topCount > 0);
  const winner = leaders.length === 1 ? leaders[0] : null;

  if (electionLoading) {
    return (
      <AppShell>
        <PageLoader label="Loading election" />
      </AppShell>
    );
  }

  if (!election) {
    return (
      <AppShell>
        <div className="container max-w-2xl px-4 py-20 sm:px-6">
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" strokeWidth={2.2} />}
            title="Election not found"
            description="This election may have been deleted."
            action={
              <Link to="/admin" className={buttonClasses("outline", "md")}>
                Back to officer panel
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to={`/admin/elections/${election.id}`}
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Back to election
        </Link>

        <div className="mt-6">
          <PageHeading
            eyebrow="Results monitor"
            title={election.title}
            description="Live tally, turnout and publication controls."
            actions={<StatusChip status={election.status} resultsPublic={election.results_public} />}
          />
        </div>

        {actionError && (
          <div className="mt-8">
            <Alert>{actionError}</Alert>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Ballots cast"
            value={turnout?.voted ?? totalVotes}
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />}
            accent="poppy"
          />
          <StatTile
            label="Eligible students"
            value={turnout?.eligible ?? "—"}
            icon={<Users className="h-4 w-4" strokeWidth={2.2} />}
            accent="cobalt"
          />
          <StatTile
            label="Turnout"
            value={
              turnout && turnout.eligible
                ? `${percent(turnout.voted, turnout.eligible)}%`
                : "—"
            }
            icon={<Vote className="h-4 w-4" strokeWidth={2.2} />}
            accent="mustard"
          />
          <StatTile
            label="Candidates"
            value={rows.length}
            icon={<BarChart3 className="h-4 w-4" strokeWidth={2.2} />}
            accent="ink"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            variant={election.results_public ? "outline" : "ink"}
            size="md"
            disabled={busy}
            onClick={() => void patchElection({ results_public: !election.results_public })}
            icon={
              election.results_public ? (
                <EyeOff className="h-4 w-4" strokeWidth={2.4} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2.4} />
              )
            }
          >
            {election.results_public ? "Unpublish results" : "Publish results"}
          </Button>

          {election.status === "active" ? (
            <Button
              variant="outline"
              size="md"
              disabled={busy}
              onClick={() => void patchElection({ status: "closed" })}
              icon={<Lock className="h-4 w-4" strokeWidth={2.4} />}
            >
              Close voting
            </Button>
          ) : (
            <Button
              variant="cobalt"
              size="md"
              disabled={busy}
              onClick={() => void patchElection({ status: "active" })}
              icon={<Vote className="h-4 w-4" strokeWidth={2.4} />}
            >
              Open voting
            </Button>
          )}

          <Button
            variant="ghost"
            size="md"
            className="border border-outline-variant"
            disabled={busy}
            onClick={() => void refreshAll()}
            icon={<RefreshCw className="h-4 w-4" strokeWidth={2.4} />}
          >
            Refresh
          </Button>

          {election.status === "active" && (
            <Button
              variant="ghost"
              size="md"
              className="border border-outline-variant"
              onClick={() => setLive((value) => !value)}
              icon={
                live ? (
                  <Pause className="h-4 w-4" strokeWidth={2.4} />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={2.4} />
                )
              }
            >
              {live ? "Pause live" : "Resume live"}
            </Button>
          )}

          <Button
            variant="cobalt"
            size="md"
            disabled={busy || rows.length === 0}
            onClick={() => void downloadResultsXlsx(rows, exportMeta)}
            icon={<Download className="h-4 w-4" strokeWidth={2.4} />}
          >
            Download results
          </Button>

          <Button
            variant="ghost"
            size="md"
            className="border border-outline-variant"
            disabled={busy || rows.length === 0}
            onClick={() => downloadResultsCsv(rows, exportMeta)}
          >
            CSV
          </Button>

          <Link
            to={`/elections/${election.id}/results`}
            className={buttonClasses("ghost", "md", "border border-outline-variant ml-auto")}
          >
            View public page
          </Link>
        </div>

        {election.status === "active" && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                live ? "animate-pulse bg-primary" : "bg-outline",
              )}
            />
            {live ? "Updating live every 10s" : "Live updates paused"}
            {lastUpdated && (
              <span className="text-on-surface-variant/70">
                · Last updated {new Date(lastUpdated).toLocaleTimeString("en-GB")}
              </span>
            )}
          </p>
        )}

        {!election.results_public && (
          <div className="mt-6">
            <Alert tone="info">
              These numbers are visible to officers only. Students cannot see the tally until you publish.
            </Alert>
          </div>
        )}

        <section className="mt-10">
          {loading ? (
            <PageLoader label="Counting ballots" />
          ) : error ? (
            <Alert>{error}</Alert>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-6 w-6" strokeWidth={2.2} />}
              title="No candidates yet"
              description="Add candidates to this election to start collecting votes."
              action={
                <Link to={`/admin/elections/${election.id}`} className={buttonClasses("outline", "md")}>
                  Manage candidates
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-outline-variant bg-surface-container px-5 py-4 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                <span>{pluralise(totalVotes, "ballot")} counted</span>
                {leaders.length > 1 && topCount > 0 && (
                  <span className="text-primary">Currently tied — no outright leader</span>
                )}
                {winner && topCount === 0 && <span>No votes have been cast yet</span>}
              </div>

              {winner && totalVotes > 0 && <WinnerCallout row={winner} totalVotes={totalVotes} />}

              <ResultsTally rows={rows} totalVotes={totalVotes} />
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
