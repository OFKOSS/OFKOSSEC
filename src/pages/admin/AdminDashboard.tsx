import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  FileStack,
  Lock,
  Pencil,
  Plus,
  ScrollText,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { StatusChip } from "@/components/ui/StatusChip";
import { StatTile } from "@/components/admin/StatTile";
import { supabase } from "@/lib/supabase";
import { describeDeadline, pluralise } from "@/utils/format";
import type { Election, ElectionStatus } from "@/types";

interface OverviewRow extends Election {
  candidateCount: number;
  voteCount: number;
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [electionsRes, candidatesRes, votesRes] = await Promise.all([
      supabase.from("elections").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("id, election_id"),
      supabase.from("votes").select("election_id"),
    ]);

    if (electionsRes.error) {
      setError(electionsRes.error.message);
      setLoading(false);
      return;
    }

    const candidateCounts = new Map<string, number>();
    for (const row of candidatesRes.data ?? []) {
      candidateCounts.set(row.election_id, (candidateCounts.get(row.election_id) ?? 0) + 1);
    }

    const voteCounts = new Map<string, number>();
    for (const row of votesRes.data ?? []) {
      voteCounts.set(row.election_id, (voteCounts.get(row.election_id) ?? 0) + 1);
    }

    setRows(
      (electionsRes.data as Election[]).map((election) => ({
        ...election,
        candidateCount: candidateCounts.get(election.id) ?? 0,
        voteCount: voteCounts.get(election.id) ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      live: rows.filter((row) => row.status === "active").length,
      candidates: rows.reduce((sum, row) => sum + row.candidateCount, 0),
      ballots: rows.reduce((sum, row) => sum + row.voteCount, 0),
    };
  }, [rows]);

  const updateElection = async (id: string, patch: Partial<Election>) => {
    setBusyId(id);
    setError(null);
    const { error: updateError } = await supabase.from("elections").update(patch).eq("id", id);
    if (updateError) setError(updateError.message);
    setBusyId(null);
    await load();
  };

  const setStatus = (id: string, status: ElectionStatus) => updateElection(id, { status });
  const toggleResults = (id: string, results_public: boolean) =>
    updateElection(id, { results_public });

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <PageHeading
          eyebrow="Officer panel"
          title="Election control room"
          description="Create elections, manage candidates, and decide exactly when voting opens and results go public."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/admin/insights" className={buttonClasses("ink", "lg")}>
                <BarChart3 className="h-4 w-4" strokeWidth={2.6} />
                Insights
              </Link>
              <Link to="/admin/voters" className={buttonClasses("outline", "lg")}>
                <UserPlus className="h-4 w-4" strokeWidth={2.6} />
                Voter register
              </Link>
              <Link to="/admin/elections/new" className={buttonClasses("primary", "lg")}>
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                New election
              </Link>
            </div>
          }
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total elections"
            value={stats.total}
            icon={<FileStack className="h-4 w-4" strokeWidth={2.2} />}
            accent="ink"
          />
          <StatTile
            label="Voting live now"
            value={stats.live}
            icon={<Vote className="h-4 w-4" strokeWidth={2.2} />}
            accent="poppy"
          />
          <StatTile
            label="Candidates"
            value={stats.candidates}
            icon={<Users className="h-4 w-4" strokeWidth={2.2} />}
            accent="cobalt"
          />
          <StatTile
            label="Ballots cast"
            value={stats.ballots}
            hint="Across all elections"
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />}
            accent="mustard"
          />
        </div>

        {error && (
          <div className="mt-8">
            <Alert>{error}</Alert>
          </div>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-variant pb-4">
            <h2 className="text-2xl font-normal text-on-surface">All elections</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              {loading ? "Loading…" : pluralise(rows.length, "election")}
            </span>
          </div>

          {loading ? (
            <PageLoader label="Loading elections" />
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-12 text-center">
              <ScrollText className="mx-auto h-8 w-8 text-on-surface-variant" strokeWidth={1.8} />
              <p className="mt-4 text-xl font-normal text-on-surface">No elections yet</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Create your first election to start adding candidates.
              </p>
              <div className="mt-6 flex justify-center">
                <Link to="/admin/elections/new" className={buttonClasses("primary", "md")}>
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                  New election
                </Link>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((election) => (
                <li
                  key={election.id}
                  className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 shadow-elev-1"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                          {election.position}
                        </span>
                        <StatusChip status={election.status} resultsPublic={election.results_public} />
                      </div>
                      <h3 className="mt-2 text-xl font-normal text-on-surface leading-tight">
                        {election.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {pluralise(election.candidateCount, "candidate")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {pluralise(election.voteCount, "ballot")}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
                          {describeDeadline(election)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/elections/${election.id}`}
                        className={buttonClasses("outline", "sm")}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                        Manage
                      </Link>
                      <Link
                        to={`/admin/elections/${election.id}/results`}
                        className={buttonClasses("ink", "sm")}
                      >
                        <BarChart3 className="h-3.5 w-3.5" strokeWidth={2.4} />
                        Results
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-outline-variant pt-4">
                    {election.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === election.id}
                        onClick={() => void setStatus(election.id, "closed")}
                        icon={<Lock className="h-3.5 w-3.5" strokeWidth={2.4} />}
                      >
                        Close voting
                      </Button>
                    ) : (
                      <Button
                        variant="cobalt"
                        size="sm"
                        disabled={busyId === election.id || election.candidateCount === 0}
                        onClick={() => void setStatus(election.id, "active")}
                        icon={<Vote className="h-3.5 w-3.5" strokeWidth={2.4} />}
                        title={
                          election.candidateCount === 0
                            ? "Add candidates before opening voting"
                            : undefined
                        }
                      >
                        Open voting
                      </Button>
                    )}

                    <Button
                      variant={election.results_public ? "outline" : "ink"}
                      size="sm"
                      disabled={busyId === election.id}
                      onClick={() => void toggleResults(election.id, !election.results_public)}
                      icon={
                        election.results_public ? (
                          <EyeOff className="h-3.5 w-3.5" strokeWidth={2.4} />
                        ) : (
                          <Eye className="h-3.5 w-3.5" strokeWidth={2.4} />
                        )
                      }
                    >
                      {election.results_public ? "Unpublish results" : "Publish results"}
                    </Button>

                    {election.status !== "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-outline-variant"
                        disabled={busyId === election.id}
                        onClick={() => void setStatus(election.id, "draft")}
                      >
                        Back to draft
                      </Button>
                    )}

                    <Link
                      to={`/elections/${election.id}`}
                      className={buttonClasses("ghost", "sm", "border border-outline-variant ml-auto")}
                    >
                      Preview ballot
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
