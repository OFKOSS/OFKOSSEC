import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Vote, X } from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { ElectionCard } from "@/components/elections/ElectionCard";
import { buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { isGenderBlocked, useElections } from "@/hooks/useElections";
import { useAuthStore, useIsAdmin } from "@/store/authStore";
import { cn } from "@/lib/utils";
import type { ElectionStatus, ElectionSummary, Gender } from "@/types";

type Filter = "all" | ElectionStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Voting live" },
  { key: "closed", label: "Closed" },
];

/**
 * A ballot the student has already cast drops off the sheet so they move on to
 * the next one — unless results are published, in which case it stays visible
 * as a way back to the tally. Officers always see everything.
 */
function hasCastBallot(election: ElectionSummary, isAdmin: boolean): boolean {
  if (isAdmin || !election.hasVoted) return false;
  return !(election.status !== "active" && election.results_public);
}

/**
 * A live ballot tied to one gender is withheld from a signed-in student of the
 * other gender (migration 017) — they are walked on to their next ballot
 * instead. Officers still see every contest, and closed elections stay listed so
 * their published results remain reachable.
 */
function withheldByGender(
  election: ElectionSummary,
  isAdmin: boolean,
  signedIn: boolean,
  gender: Gender | null,
): boolean {
  if (isAdmin || !signedIn || election.status !== "active") return false;
  return isGenderBlocked(election, gender);
}

export default function Elections() {
  const { elections, loading, error, reload } = useElections();
  const session = useAuthStore((state) => state.session);
  const profileGender = useAuthStore((state) => state.profile?.gender ?? null);
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // A contest is hidden from the sheet when the student has already voted in it,
  // or when it is a live ballot their gender may not vote in.
  const withheld = useCallback(
    (election: ElectionSummary) =>
      hasCastBallot(election, isAdmin) ||
      withheldByGender(election, isAdmin, Boolean(session), profileGender),
    [isAdmin, session, profileGender],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return elections.filter((election) => {
      // Students never see drafts; the RLS layer already hides them, this is belt and braces.
      if (election.status === "draft") return false;
      if (withheld(election)) return false;
      if (filter !== "all" && election.status !== filter) return false;
      if (!needle) return true;
      return (
        election.title.toLowerCase().includes(needle) ||
        election.position.toLowerCase().includes(needle)
      );
    });
  }, [elections, filter, query, withheld]);

  const liveCount = elections.filter(
    (election) => election.status === "active" && !withheld(election),
  ).length;

  const nothingLeftToVote =
    Boolean(session) &&
    !isAdmin &&
    elections.some((election) => election.hasVoted) &&
    !elections.some((election) => election.status === "active" && !withheld(election));

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <PageHeading
          eyebrow="Ballot sheet"
          title="Elections"
          description="Every contest your school is running. Pick one to read the manifestos and cast your vote."
          actions={
            <div className="rounded-2xl border border-outline-variant bg-surface-container-low px-5 py-4 shadow-elev-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">Open now</p>
              <p className="mt-1 text-3xl font-normal leading-none text-primary">{liveCount}</p>
            </div>
          }
        />

        <div className="mt-8 flex flex-col gap-4 border-b border-outline-variant pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  filter === option.key
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface",
                )}
                aria-pressed={filter === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              strokeWidth={2.2}
            />
            <input
              id="election-search"
              name="election-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search elections…"
              aria-label="Search elections"
              className="w-full rounded-full border border-outline bg-surface-container-low py-2.5 pl-10 pr-10 font-sans text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 hover:border-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

        {!loading && !error && nothingLeftToVote && (
          <div className="mt-8">
            <Alert tone="success">
              <span className="flex flex-col gap-1">
                <span className="font-semibold">You have voted in every open election.</span>
                <span className="font-normal">
                  Nothing is left on your ballot sheet — new elections appear here as soon as your Electoral
                  Officer opens them. Your voting history is on the My ballot page.
                </span>
              </span>
            </Alert>
          </div>
        )}

        <div className="mt-8">
          {loading ? (
            <PageLoader label="Fetching the ballot sheet" />
          ) : error ? (
            <div className="flex flex-col gap-4">
              <Alert>{error}</Alert>
              <button
                type="button"
                onClick={() => void reload()}
                className={buttonClasses("outline", "md", "self-start")}
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Vote className="h-6 w-6" strokeWidth={2.2} />}
              title={query || filter !== "all" ? "No elections match" : "No elections yet"}
              description={
                query || filter !== "all"
                  ? "Try a different filter or clear your search."
                  : "When your Electoral Officer opens voting, it will show up right here."
              }
              action={
                (query || filter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                    className={buttonClasses("outline", "md")}
                  >
                    Clear filters
                  </button>
                )
              }
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((election) => (
                <ElectionCard key={election.id} election={election} />
              ))}
            </div>
          )}
        </div>

        {!loading && !error && visible.length > 0 && (
          <p className="mt-10 border-t border-dashed border-outline-variant pt-6 text-center text-sm text-on-surface-variant">
            Ready to vote?{" "}
            <Link to="/login" className="link-underline">
              Sign in with your index number
            </Link>{" "}
            and your class. Not on the register yet? Ask your Electoral Officer to add you.
          </p>
        )}
      </div>
    </AppShell>
  );
}
