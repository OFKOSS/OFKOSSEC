import { CheckCircle2, Info, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface BallotBarProps {
  electionTitle: string;
  selectedName: string | null;
  isLive: boolean;
  hasVoted: boolean;
  /** The voter already voted and is replacing that ballot rather than casting
   *  a first one, so the labels change and skipping is hidden. */
  editing: boolean;
  isSignedIn: boolean;
  submitting: boolean;
  skipping: boolean;
  onCastVote: () => void;
  onSignIn: () => void;
  onSkip: () => void;
}

/** Sticky action bar that carries the ballot through to submission. */
export function BallotBar({
  electionTitle,
  selectedName,
  isLive,
  hasVoted,
  editing,
  isSignedIn,
  submitting,
  skipping,
  onCastVote,
  onSignIn,
  onSkip,
}: BallotBarProps) {
  return (
    <div className="sticky bottom-0 z-40 border-t border-outline-variant bg-surface-container-high/95 backdrop-blur">
      <div className="container flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-on-surface-variant">{electionTitle}</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-on-surface">
            {hasVoted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-tertiary" strokeWidth={2.4} />
                Your ballot has been cast
              </>
            ) : selectedName ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-tertiary" strokeWidth={2.4} />
                <span className="truncate">Voting for {selectedName}</span>
              </>
            ) : isLive ? (
              <>
                <Info className="h-4 w-4 text-on-surface-variant" strokeWidth={2.2} />
                Select one candidate to continue
              </>
            ) : (
              <>
                <Info className="h-4 w-4 text-on-surface-variant" strokeWidth={2.2} />
                Voting is not open for this election
              </>
            )}
          </p>
        </div>

        <div className={cn("flex shrink-0 items-center gap-3")}>
          {isSignedIn ? (
            <>
              {isLive && !hasVoted && !editing && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={onSkip}
                  disabled={submitting || skipping}
                  className="border border-outline-variant flex-1 sm:flex-none"
                >
                  <SkipForward className="h-4 w-4" strokeWidth={2.4} />
                  {skipping ? "Skipping…" : "Skip this one"}
                </Button>
              )}
              <Button
                size="lg"
                onClick={onCastVote}
                disabled={!isLive || hasVoted || !selectedName || submitting || skipping}
                className="flex-1 sm:flex-none"
              >
                {submitting
                  ? editing
                    ? "Saving…"
                    : "Casting…"
                  : hasVoted
                    ? "Vote recorded"
                    : editing
                      ? "Save my new vote"
                      : "Cast my vote"}
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={onSignIn} className="w-full sm:w-auto">
              Sign in to vote
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
