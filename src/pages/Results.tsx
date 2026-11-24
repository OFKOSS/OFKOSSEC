import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, EyeOff, Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { StatusChip } from "@/components/ui/StatusChip";
import { ResultsTally, WinnerCallout } from "@/components/results/ResultsTally";
import { useElectionDetail, useResults } from "@/hooks/useElections";
import { pluralise } from "@/utils/format";

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const { election, loading: electionLoading } = useElectionDetail(id);
  const { rows, loading, error, reload } = useResults(id);

  const totalVotes = rows.reduce((sum, row) => sum + Number(row.vote_count), 0);
  const topCount = rows.length ? Math.max(...rows.map((row) => Number(row.vote_count))) : 0;
  const leaders = rows.filter((row) => Number(row.vote_count) === topCount && topCount > 0);
  const winner = leaders.length === 1 ? leaders[0] : null;

  return (
    <AppShell>
      <div className="container max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <Link
          to={id ? `/elections/${id}` : "/elections"}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Back to ballot
        </Link>

        {electionLoading ? (
          <PageLoader label="Loading election" />
        ) : election ? (
          <header className="mt-6 border-b border-outline-variant pb-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                {election.position}
              </span>
              <StatusChip status={election.status} resultsPublic={election.results_public} />
            </div>
            <h1 className="mt-4 text-4xl font-normal leading-[1.1] text-on-surface sm:text-5xl">
              {election.title}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              <BarChart3 className="h-4 w-4" strokeWidth={2.2} />
              Official tally
            </p>
          </header>
        ) : null}

        <div className="mt-8">
          {loading ? (
            <PageLoader label="Counting the ballots" />
          ) : error ? (
            <div className="flex flex-col gap-5">
              <EmptyState
                icon={<EyeOff className="h-6 w-6" strokeWidth={2.2} />}
                title="Results are sealed"
                description="The Electoral Officer has not published the results for this election yet. Check back after voting closes."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link to={id ? `/elections/${id}` : "/elections"} className={buttonClasses("outline", "md")}>
                      Back to ballot
                    </Link>
                    <button type="button" onClick={() => void reload()} className={buttonClasses("ghost", "md")}>
                      Refresh
                    </button>
                  </div>
                }
              />
              <Alert tone="info">{error}</Alert>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" strokeWidth={2.2} />}
              title="No candidates to count"
              description="This election had no candidates on the ballot."
            />
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-outline-variant bg-surface-container px-5 py-4 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" strokeWidth={2.2} />
                  {pluralise(rows.length, "candidate")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" strokeWidth={2.2} />
                  {pluralise(totalVotes, "ballot")} cast
                </span>
                {leaders.length > 1 && topCount > 0 && (
                  <span className="text-primary">Tie at the top — no outright winner</span>
                )}
              </div>

              {winner && <WinnerCallout row={winner} totalVotes={totalVotes} />}

              <ResultsTally rows={rows} totalVotes={totalVotes} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
