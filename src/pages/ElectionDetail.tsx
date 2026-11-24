import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Info,
  Lock,
  Loader2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { CandidateCard } from "@/components/ballot/CandidateCard";
import { BallotBar } from "@/components/ballot/BallotBar";
import { useElectionDetail, fetchRemainingOpenElections, markElectionSkipped } from "@/hooks/useElections";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { describeDeadline, formatDateTime, pluralise } from "@/utils/format";
import type { Election } from "@/types";

export default function ElectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { election, candidates, hasVoted, loading, error, reload } = useElectionDetail(id);

  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const [justVoted, setJustVoted] = useState(false);
  const [nextElection, setNextElection] = useState<Election | null>(null);
  const [findingNext, setFindingNext] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? null,
    [candidates, selectedId],
  );

  const isLive = election?.status === "active";
  const resultsAvailable =
    election?.status === "closed" && Boolean(election?.results_public);

  useEffect(() => {
    setSelectedId(null);
    setJustVoted(false);
    setNextElection(null);
    setFindingNext(false);
  }, [id]);

  // Once a student has confirmed their ballot, walk them on to the next
  // election they have not voted in yet, until every one has been cast.
  useEffect(() => {
    if (!justVoted || findingNext) return;
    const target = nextElection ? `/elections/${nextElection.id}` : "/elections";
    const timer = window.setTimeout(() => navigate(target, { replace: true }), 4000);
    return () => window.clearTimeout(timer);
  }, [justVoted, findingNext, nextElection, navigate]);

  const castVote = async () => {
    if (!election || !selectedId || !userId) return;

    setSubmitting(true);
    setCastError(null);

    const { error: insertError } = await supabase.from("votes").insert({
      election_id: election.id,
      candidate_id: selectedId,
      voter_id: userId,
    });

    if (insertError) {
      // 23505 = unique violation: this student already voted in this election.
      if (insertError.code === "23505") {
        setCastError("Our records already show a ballot from your account in this election.");
      } else {
        setCastError(insertError.message);
      }
      setSubmitting(false);
      await reload();
      return;
    }

    setSubmitting(false);
    setConfirmOpen(false);
    setJustVoted(true);
    setFindingNext(true);
    await reload();

    const remaining = await fetchRemainingOpenElections(election.id);
    setNextElection(remaining[0] ?? null);
    setFindingNext(false);
  };

  // Skipping is not a vote: nothing is written to the database. We only remember
  // the choice for this session and move the student on to their next ballot.
  const skipElection = async () => {
    if (!election) return;
    setSkipping(true);
    markElectionSkipped(election.id);
    const remaining = await fetchRemainingOpenElections(election.id);
    const target = remaining[0];
    setSkipping(false);
    navigate(target ? `/elections/${target.id}` : "/elections", { replace: true });
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Opening the ballot" />
      </AppShell>
    );
  }

  if (error || !election) {
    return (
      <AppShell>
        <div className="container max-w-2xl px-4 py-20 sm:px-6">
          <EmptyState
            icon={<Info className="h-6 w-6" strokeWidth={2.2} />}
            title="Election not available"
            description={error ?? "This election may have been removed, or it has not been announced yet."}
            action={
              <Link to="/elections" className={buttonClasses("outline", "md")}>
                Back to elections
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const locked = hasVoted || justVoted;

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <Link
          to="/elections"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          All elections
        </Link>

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

          {election.description && (
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-on-surface-variant">
              {election.description}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" strokeWidth={2.2} />
              {pluralise(candidates.length, "candidate")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" strokeWidth={2.2} />
              {describeDeadline(election)}
            </span>
            {election.ends_at && (
              <span>Closes {formatDateTime(election.ends_at)}</span>
            )}
          </div>
        </header>

        {justVoted && (
          <div className="mt-8 rounded-[28px] border border-tertiary/40 bg-tertiary-container/50 p-6 sm:p-7">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary text-on-tertiary">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <div>
                <h2 className="text-2xl font-normal leading-tight text-on-tertiary-container">
                  Your ballot has been cast
                </h2>
                <p className="mt-1 text-sm text-on-tertiary-container/80">
                  It is sealed and cannot be changed.
                </p>
              </div>
            </div>

            {findingNext ? (
              <p className="mt-5 flex items-center gap-2 text-sm text-on-tertiary-container">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
                Looking for your next ballot…
              </p>
            ) : nextElection ? (
              <>
                <p className="mt-5 text-sm text-on-tertiary-container">
                  Still to vote: <strong>{nextElection.title}</strong> ({nextElection.position}). Taking you
                  there now.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button onClick={() => navigate(`/elections/${nextElection.id}`, { replace: true })}>
                    Vote in {nextElection.title}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </Button>
                  <Link to="/elections" className={buttonClasses("outline", "md")}>
                    See all elections
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-5 text-sm text-on-tertiary-container">
                  That was the last one — you have voted in every election that is open. Thank you for taking
                  part.
                </p>
                <Link to="/elections" className={buttonClasses("outline", "md", "mt-5")}>
                  Back to the ballot sheet
                </Link>
              </>
            )}
          </div>
        )}

        {hasVoted && !justVoted && (
          <div className="mt-8">
            <Alert tone="success">
              <span className="flex flex-col gap-1">
                <span className="font-semibold">Your ballot has been cast.</span>
                <span className="font-normal">
                  It is sealed and cannot be changed. Thank you for voting — results appear here once they
                  are published.
                </span>
              </span>
            </Alert>
          </div>
        )}

        {!isLive && !locked && (
          <div className="mt-8">
            <Alert tone="info">
              {election.status === "closed"
                ? "Voting for this election has closed."
                : "Voting has not opened for this election yet."}
            </Alert>
          </div>
        )}

        {isLive && !locked && (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed border-tertiary/50 bg-tertiary-container/40 px-4 py-3 text-sm text-on-tertiary-container">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <p>
              Your choice is anonymous. Pick one candidate below, then confirm on the bar at the bottom of
              the screen.
            </p>
          </div>
        )}

        <div
          role="radiogroup"
          aria-label={`Candidates for ${election.position}`}
          className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={selectedId === candidate.id}
              disabled={!isLive || locked}
              onSelect={setSelectedId}
            />
          ))}
        </div>

        {candidates.length === 0 && (
          <div className="mt-8">
            <EmptyState
              icon={<Users className="h-6 w-6" strokeWidth={2.2} />}
              title="No candidates yet"
              description="The Electoral Officer has not added candidates to this election."
            />
          </div>
        )}

        {resultsAvailable && (
          <div className="mt-10 flex flex-col items-start gap-4 rounded-[28px] bg-primary-container p-6 text-on-primary-container sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-normal">Results are published</h2>
              <p className="mt-1 text-sm opacity-80">
                See the full tally for this election.
              </p>
            </div>
            <Link to={`/elections/${election.id}/results`} className={buttonClasses("cobalt", "lg")}>
              <BarChart3 className="h-4 w-4" strokeWidth={2.4} />
              View results
            </Link>
          </div>
        )}

        {castError && (
          <div className="mt-8">
            <Alert>{castError}</Alert>
          </div>
        )}
      </div>

      <BallotBar
        electionTitle={election.title}
        selectedName={selectedCandidate?.name ?? null}
        isLive={isLive}
        hasVoted={locked}
        isSignedIn={Boolean(session)}
        submitting={submitting}
        skipping={skipping}
        onCastVote={() => setConfirmOpen(true)}
        onSkip={() => void skipElection()}
        onSignIn={() =>
          navigate("/login", { state: { from: `/elections/${election.id}` } })
        }
      />

      <Modal
        open={confirmOpen}
        title="Confirm your ballot"
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Go back
            </Button>
            <Button onClick={() => void castVote()} disabled={submitting}>
              {submitting ? "Casting…" : "Cast my vote"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          You are about to vote for
        </p>
        <p className="mt-2 flex items-center gap-2 text-2xl font-normal text-on-surface">
          <CheckCircle2 className="h-5 w-5 text-tertiary" strokeWidth={2.4} />
          {selectedCandidate?.name}
        </p>
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          This cannot be undone. You will not be able to vote again in this election, and your choice stays
          secret.
        </p>
      </Modal>
    </AppShell>
  );
}
