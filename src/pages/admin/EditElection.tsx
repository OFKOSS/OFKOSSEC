import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BarChart3, RotateCcw, Trash2 } from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { ElectionForm } from "@/components/admin/ElectionForm";
import { CandidateManager } from "@/components/admin/CandidateManager";
import { supabase } from "@/lib/supabase";
import { pluralise } from "@/utils/format";
import type { Election, ElectionDraft } from "@/types";

export default function EditElection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  /** Ballots waiting to be cleared, counted when the confirmation opens. */
  const [ballotCount, setBallotCount] = useState<number | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("elections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
      setNotFound(true);
    } else if (!data) {
      setNotFound(true);
    } else {
      setElection(data as Election);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (draft: ElectionDraft) => {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("elections")
      .update({
        title: draft.title,
        position: draft.position,
        description: draft.description || null,
        status: draft.status,
        results_public: draft.results_public,
        eligible_gender: draft.eligible_gender,
        starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
        ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
    await load();
  };

  // Clearing the ballots is what lets the same election be run again for real.
  // The count is read first so the officer confirms against a real number.
  const openReset = async () => {
    if (!id) return;
    setError(null);
    setResetNotice(null);
    setBallotCount(null);
    setResetOpen(true);

    const { count } = await supabase
      .from("ballot_receipts")
      .select("voter_id", { count: "exact", head: true })
      .eq("election_id", id);
    setBallotCount(count ?? 0);
  };

  const resetBallots = async () => {
    if (!id) return;
    setResetting(true);
    setError(null);

    // Officers may not delete ballots directly; the register is cleared by an
    // officer-only function that also writes to the audit trail.
    const { data, error: resetError } = await supabase.rpc("admin_reset_election_ballots", {
      p_election_id: id,
    });

    setResetting(false);
    setResetOpen(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setResetNotice(
      `${pluralise(Number(data) || 0, "ballot")} cleared. Every student can vote in this election again.`,
    );
  };

  const deleteElection = async () => {
    if (!id) return;
    setDeleting(true);

    // Clear dependent candidates first: the schema uses logical foreign keys,
    // so nothing cascades automatically.
    await supabase.from("candidates").delete().eq("election_id", id);
    const { error: deleteError } = await supabase.from("elections").delete().eq("id", id);

    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      setDeleteOpen(false);
      return;
    }

    navigate("/admin", { replace: true });
  };

  // The confirmation leads with the count, so it can only be finished once the
  // count is in and there is something to clear.
  const resetSummary =
    ballotCount === null
      ? "Counting the ballots already cast…"
      : ballotCount === 0
        ? "No ballots have been cast in this election yet."
        : null;

  if (loading) {
    return (
      <AppShell>
        <PageLoader label="Loading election" />
      </AppShell>
    );
  }

  if (notFound || !election) {
    return (
      <AppShell>
        <div className="container max-w-2xl px-4 py-20 sm:px-6">
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" strokeWidth={2.2} />}
            title="Election not found"
            description={error ?? "This election may have been deleted."}
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
          to="/admin"
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Officer panel
        </Link>

        <div className="mt-6">
          <PageHeading
            eyebrow="Manage election"
            title={election.title}
            description={election.position}
            actions={
              <Link
                to={`/admin/elections/${election.id}/results`}
                className={buttonClasses("ink", "md")}
              >
                <BarChart3 className="h-4 w-4" strokeWidth={2.4} />
                Live results
              </Link>
            }
          />
        </div>

        {error && !notFound && (
          <div className="mt-8">
            <Alert>{error}</Alert>
          </div>
        )}

        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-normal text-on-surface">Election details</h2>
          <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-6 shadow-elev-2 sm:p-8">
            {saved && (
              <div className="mb-5">
                <Alert tone="success">Election details saved.</Alert>
              </div>
            )}
            <ElectionForm
              key={election.id + election.status + String(election.results_public) + election.eligible_gender}
              initial={{
                title: election.title,
                position: election.position,
                description: election.description ?? "",
                status: election.status,
                results_public: election.results_public,
                eligible_gender: election.eligible_gender,
                starts_at: election.starts_at,
                ends_at: election.ends_at,
              }}
              submitLabel="Save changes"
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </div>
        </section>

        <section className="mt-12 border-t border-outline-variant pt-10">
          <CandidateManager electionId={election.id} />
        </section>

        <section className="mt-12 border-t border-outline-variant pt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-xl font-normal text-on-surface">Clear the votes cast</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Removes every ballot cast in this election and lets students vote in it again. The
                election, its candidates and the register are kept as they are — for clearing a trial
                run before the real poll.
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={() => void openReset()}
              icon={<RotateCcw className="h-4 w-4" strokeWidth={2.4} />}
            >
              Reset votes
            </Button>
          </div>

          {resetNotice && (
            <div className="mt-5">
              <Alert tone="success">{resetNotice}</Alert>
            </div>
          )}
        </section>

        <section className="mt-12 border-t border-dashed border-outline-variant pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-normal text-on-surface">Delete this election</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Removes the election and all of its candidates. This cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={() => setDeleteOpen(true)}
              icon={<Trash2 className="h-4 w-4" strokeWidth={2.4} />}
            >
              Delete election
            </Button>
          </div>
        </section>
      </div>

      <Modal
        open={resetOpen}
        title="Clear the votes cast?"
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
              onClick={() => void resetBallots()}
              disabled={resetting || ballotCount === 0}
            >
              {resetting ? "Clearing…" : "Yes, clear the votes"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {resetSummary ?? (
            <>
              {pluralise(ballotCount ?? 0, "ballot")} will be deleted from{" "}
              <strong className="text-on-surface">{election.title}</strong>.
            </>
          )}
        </p>
        <p className="mt-4 border-t border-dashed border-outline-variant pt-4 text-xs leading-relaxed text-on-surface-variant">
          Only the ballots go: the election, its candidates and the register stay exactly as they are,
          and every student can vote in it again. Nothing brings the cleared ballots back.
        </p>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete this election?"
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        footer={
          <>
            <Button
              variant="ghost"
              className="border border-outline-variant"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void deleteElection()} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-on-surface-variant">
          <strong className="text-on-surface">{election.title}</strong> and its candidates will be permanently
          removed. Any ballots already cast in it will no longer be counted.
        </p>
      </Modal>
    </AppShell>
  );
}
