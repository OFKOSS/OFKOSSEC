import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileStack,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/Button";
import { Alert, EmptyState, PageLoader } from "@/components/ui/Feedback";
import { StatTile } from "@/components/admin/StatTile";
import { StatusChip } from "@/components/ui/StatusChip";
import { supabase } from "@/lib/supabase";
import { percent, pluralise } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { Election, Gender } from "@/types";

interface InsightRow extends Election {
  candidateCount: number;
  voteCount: number;
}

/** Registered voters, split so a gender-restricted contest can be measured
 *  against the students who could actually vote in it. */
interface Register {
  all: number;
  male: number;
  female: number;
}

/** Officer-only roll-up of turnout across every election on the register. */
export default function AdminInsights() {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [register, setRegister] = useState<Register>({ all: 0, male: 0, female: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [electionsRes, candidatesRes, votesRes, registerRes] = await Promise.all([
      supabase.from("elections").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("id, election_id"),
      supabase.from("votes").select("election_id"),
      // Same register definition the turnout RPC uses: an account is not a
      // voter. Without the student_id filter a stray sign-up would be counted
      // as eligible on this screen while the results screen ignored it. Gender
      // comes along so a restricted election is measured against matching
      // students, exactly as get_election_turnout does (migration 017).
      supabase
        .from("profiles")
        .select("gender")
        .eq("role", "student")
        .not("student_id", "is", null),
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

    const next: Register = { all: 0, male: 0, female: 0 };
    for (const row of (registerRes.data ?? []) as { gender: Gender | null }[]) {
      next.all += 1;
      if (row.gender === "male") next.male += 1;
      else if (row.gender === "female") next.female += 1;
    }

    setRows(
      (electionsRes.data as Election[]).map((election) => ({
        ...election,
        candidateCount: candidateCounts.get(election.id) ?? 0,
        voteCount: voteCounts.get(election.id) ?? 0,
      })),
    );
    setRegister(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Students who could actually vote in a given election — the whole
   *  register for an open contest, the matching gender for a restricted one. */
  const eligibleFor = useCallback(
    (election: Election) =>
      election.eligible_gender === "any"
        ? register.all
        : election.eligible_gender === "male"
          ? register.male
          : register.female,
    [register],
  );

  const stats = useMemo(() => {
    const ballots = rows.reduce((sum, row) => sum + row.voteCount, 0);
    const live = rows.filter((row) => row.status === "active").length;
    const counted = rows.filter((row) => row.status !== "draft");
    return {
      ballots,
      live,
      counting: counted.length,
      candidates: rows.reduce((sum, row) => sum + row.candidateCount, 0),
      // Sum the per-election eligible pools so a restricted contest does not
      // inflate the denominator with students who could never vote in it.
      turnout: percent(
        ballots,
        counted.reduce((sum, row) => sum + eligibleFor(row), 0),
      ),
    };
  }, [rows, eligibleFor]);

  const busiest = rows.length ? Math.max(...rows.map((row) => row.voteCount), 1) : 1;

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
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
            title="Insight report"
            description="How many ballots have been cast across every election, with turnout for each contest."
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Ballots cast"
            value={stats.ballots}
            hint="Across all elections"
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />}
            accent="poppy"
          />
          <StatTile
            label="Average turnout"
            value={`${stats.turnout}%`}
            hint={stats.counting ? `of possible ballots in ${pluralise(stats.counting, "election")}` : "No elections yet"}
            icon={<TrendingUp className="h-4 w-4" strokeWidth={2.2} />}
            accent="cobalt"
          />
          <StatTile
            label="Registered students"
            value={register.all}
            hint="Eligible voters on the register"
            icon={<Users className="h-4 w-4" strokeWidth={2.2} />}
            accent="mustard"
          />
          <StatTile
            label="Total elections"
            value={rows.length}
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
            accent="ink"
          />
        </div>

        {error && (
          <div className="mt-8">
            <Alert>{error}</Alert>
          </div>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-variant pb-4">
            <h2 className="text-2xl font-normal text-on-surface">Votes by election</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              {loading ? "Loading…" : pluralise(rows.length, "election")}
            </span>
          </div>

          {loading ? (
            <PageLoader label="Crunching the numbers" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" strokeWidth={2.2} />}
              title="Nothing to report yet"
              description="Once you create elections and students start voting, the tally appears here."
              action={
                <Link to="/admin/elections/new" className={buttonClasses("primary", "md")}>
                  New election
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((election) => {
                const turnout = percent(election.voteCount, eligibleFor(election));
                const width = Math.round((election.voteCount / busiest) * 100);
                return (
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
                        <h3 className="mt-2 text-xl font-normal leading-tight text-on-surface">
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
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-3xl font-normal leading-none text-on-surface">{turnout}%</p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                            turnout
                          </p>
                        </div>
                        <Link
                          to={`/admin/elections/${election.id}/results`}
                          className={buttonClasses("outline", "sm")}
                        >
                          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2.4} />
                          Results
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-700 ease-out",
                          election.status === "active" ? "bg-primary" : "bg-tertiary",
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
