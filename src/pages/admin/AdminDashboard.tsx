import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileStack,
  Lock,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  ScrollText,
  Trash2,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, PageLoader } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { StatTile } from "@/components/admin/StatTile";
import { supabase } from "@/lib/supabase";
import {
  downloadResultsSummaryXlsx,
  printResultsSummary,
  type ResultsSummarySection,
} from "@/lib/spreadsheet";
import { describeDeadline, pluralise } from "@/utils/format";
import type { Election, ElectionResultRow, ElectionStatus } from "@/types";

interface OverviewRow extends Election {
  candidateCount: number;
  voteCount: number;
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  /** Every ballot row on file — what a full reset clears, strays included. */
  const [ballotsOnFile, setBallotsOnFile] = useState(0);

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
    // Ballots whose election has been deleted belong to no listed election, but
    // a full reset still clears them, so the tally is kept separately.
    setBallotsOnFile((votesRes.data ?? []).length);

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

  /**
   * Every election's tally, assembled for the summary export. Turnout comes from
   * the same RPC the results screens use, so the figures agree everywhere.
   */
  const buildSummarySections = useCallback(async (): Promise<ResultsSummarySection[]> => {
    return Promise.all(
      rows.map(async (election) => {
        const [tallyRes, turnoutRes] = await Promise.all([
          supabase.rpc("get_election_results", { p_election_id: election.id }),
          supabase.rpc("get_election_turnout", { p_election_id: election.id }),
        ]);
        if (tallyRes.error) throw new Error(`${election.title}: ${tallyRes.error.message}`);
        if (turnoutRes.error) throw new Error(`${election.title}: ${turnoutRes.error.message}`);

        const turnout = Array.isArray(turnoutRes.data) ? turnoutRes.data[0] : null;
        return {
          meta: {
            title: election.title,
            position: election.position,
            status: election.status,
            voted: Number(turnout?.voted ?? election.voteCount),
            eligible: Number(turnout?.eligible ?? 0),
          },
          rows: (tallyRes.data as ElectionResultRow[]) ?? [],
        };
      }),
    );
  }, [rows]);

  const downloadSummary = async () => {
    setReporting(true);
    setReportError(null);
    try {
      await downloadResultsSummaryXlsx(await buildSummarySections());
    } catch (thrown) {
      setReportError(
        thrown instanceof Error ? thrown.message : "Could not build the results summary.",
      );
    } finally {
      setReporting(false);
    }
  };

  const printSummary = async () => {
    setReporting(true);
    setReportError(null);
    try {
      const opened = printResultsSummary(await buildSummarySections());
      if (!opened) {
        setReportError(
          "Your browser blocked the print window. Allow pop-ups for this site, then try again.",
        );
      }
    } catch (thrown) {
      setReportError(
        thrown instanceof Error ? thrown.message : "Could not build the results summary.",
      );
    } finally {
      setReporting(false);
    }
  };

  const openReset = () => {
    setError(null);
    setResetNotice(null);
    setResetOpen(true);
  };

  const resetAllBallots = async () => {
    setResetting(true);
    setError(null);
    setResetNotice(null);
    const { data, error: resetError } = await supabase.rpc("admin_reset_all_ballots");
    setResetting(false);
    setResetOpen(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetNotice(
      `${pluralise(Number(data) || 0, "ballot")} cleared. Every student can vote again from a clean sheet.`,
    );
    await load();
  };

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
              <Link to="/admin/audit" className={buttonClasses("outline", "lg")}>
                <ScrollText className="h-4 w-4" strokeWidth={2.6} />
                Audit trail
              </Link>
              <Link to="/admin/deleted" className={buttonClasses("outline", "lg")}>
                <Trash2 className="h-4 w-4" strokeWidth={2.6} />
                Deleted elections
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

        {resetNotice && (
          <div className="mt-6">
            <Alert tone="success">{resetNotice}</Alert>
          </div>
        )}

        {reportError && (
          <div className="mt-6">
            <Alert>{reportError}</Alert>
          </div>
        )}

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6 shadow-elev-1">
            <h2 className="text-xl font-normal text-on-surface">Results summary</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Every election in one document: turnout, the winner and the full tally behind it.
              Download it as a workbook, or print it — the print view is laid out for A4, so it saves
              straight to PDF.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="ink"
                size="md"
                onClick={() => void downloadSummary()}
                disabled={reporting || rows.length === 0}
                icon={<Download className="h-4 w-4" strokeWidth={2.4} />}
              >
                {reporting ? "Preparing…" : "Download summary"}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => void printSummary()}
                disabled={reporting || rows.length === 0}
                icon={<Printer className="h-4 w-4" strokeWidth={2.4} />}
              >
                Print / save as PDF
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6 shadow-elev-1">
            <h2 className="text-xl font-normal text-on-surface">Clear every vote cast</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Wipes the ballots from every election at once — the quickest way to clear a rehearsal
              before the real poll. Elections, candidates and the register are left alone, and a
              single election can be cleared on its own from Manage.
            </p>
            <div className="mt-5">
              <Button
                variant="outline"
                size="md"
                onClick={openReset}
                disabled={ballotsOnFile === 0}
                icon={<RotateCcw className="h-4 w-4" strokeWidth={2.4} />}
              >
                Reset all votes
              </Button>
            </div>
            {ballotsOnFile === 0 && (
              <p className="mt-3 text-xs text-on-surface-variant">
                There are no ballots to clear right now.
              </p>
            )}
          </div>
        </section>

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

      <Modal
        open={resetOpen}
        title="Clear every vote cast?"
        onClose={() => (resetting ? undefined : setResetOpen(false))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void resetAllBallots()}
              disabled={resetting || ballotsOnFile === 0}
            >
              {resetting ? "Clearing…" : "Yes, clear every ballot"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {pluralise(ballotsOnFile, "ballot")} will be deleted. For a single election instead, clear
          it from that election&apos;s Manage page.
        </p>
        {ballotsOnFile > stats.ballots && (
          <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
            That includes {pluralise(ballotsOnFile - stats.ballots, "ballot")} left behind by
            elections you have since deleted. They belong to no election you can open, so this is
            the only place to clear them.
          </p>
        )}
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          Only the ballots go: the elections, their candidates and the register stay exactly as they
          are, and every student can vote again. Nothing brings the cleared ballots back.
        </p>
      </Modal>
    </AppShell>
  );
}
