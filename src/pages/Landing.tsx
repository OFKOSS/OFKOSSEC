import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
  Vote,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useElections } from "@/hooks/useElections";
import { describeDeadline, pluralise } from "@/utils/format";

export default function Landing() {
  const { elections, loading } = useElections();
  const live = elections.find((election) => election.status === "active") ?? null;

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-outline-variant bg-surface-container-low">
        <div className="halftone pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="container relative grid max-w-6xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <p
              className="animate-fade-up text-xs font-medium uppercase tracking-[0.14em] text-primary"
              style={{ animationDelay: "0ms" }}
            >
              SHS student council &amp; prefect elections
            </p>

            <h1
              className="mt-5 animate-fade-up text-5xl font-normal leading-[1.05] tracking-tight text-on-surface sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "70ms" }}
            >
              Your school.
              <br />
              Your prefects.
              <br />
              <span className="relative inline-block text-primary">
                Your vote.
              </span>
            </h1>

            <p
              className="mt-7 max-w-xl animate-fade-up text-lg leading-relaxed text-on-surface-variant"
              style={{ animationDelay: "140ms" }}
            >
              OFKOSSEC runs student council and prefect elections end to end: verified student accounts,
              one secret ballot each, and a tally your whole school can check.
            </p>

            <div
              className="mt-9 flex animate-fade-up flex-wrap items-center gap-4"
              style={{ animationDelay: "210ms" }}
            >
              <Link to="/elections" className={buttonClasses("primary", "lg")}>
                <Vote className="h-4 w-4" strokeWidth={2.4} />
                See live elections
              </Link>
              <Link to="/login" className={buttonClasses("outline", "lg")}>
                Sign in to vote
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </Link>
            </div>

            <div
              className="mt-10 flex animate-fade-up flex-wrap items-center gap-x-8 gap-y-3 border-t border-dashed border-outline-variant pt-6 text-xs font-medium text-on-surface-variant"
              style={{ animationDelay: "280ms" }}
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                Verified students only
              </span>
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                Secret ballots
              </span>
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                Published results
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute -left-6 top-6 hidden lg:block">
              <span className="stamp-label">One student · one vote</span>
            </div>

            {loading ? (
              <div className="h-72 w-full max-w-sm animate-pulse rounded-[28px] bg-surface-container-high" />
            ) : live ? (
              <Link
                to={`/elections/${live.id}`}
                className="group relative w-full max-w-sm animate-fade-up"
                style={{ animationDelay: "180ms" }}
              >
                <div className="overflow-hidden rounded-[28px] bg-surface-container-low shadow-elev-2 transition-shadow duration-200 group-hover:shadow-elev-3">
                  <div className="flex items-center justify-between bg-primary px-5 py-3 text-on-primary">
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em]">Now voting</span>
                    <StatusChip status={live.status} className="border-on-primary/40 bg-on-primary/15 text-on-primary" />
                  </div>
                  <div className="p-6">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                      {live.position}
                    </p>
                    <h2 className="mt-3 text-3xl font-normal leading-tight text-on-surface">{live.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
                      {live.description}
                    </p>

                    <div className="mt-5 flex flex-col gap-2.5">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="flex items-center gap-3 border-b border-dashed border-outline-variant pb-2.5">
                          <span className="h-4 w-4 shrink-0 rounded-full border border-outline-variant" />
                          <span className="h-2.5 flex-1 rounded-full bg-on-surface/10" />
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-on-surface-variant">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" strokeWidth={2.2} />
                        {pluralise(live.candidateCount, "candidate")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
                        {describeDeadline(live)}
                      </span>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-outline-variant pt-4 text-primary">
                      <span className="text-[11px] font-medium uppercase tracking-[0.1em]">Open the ballot</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div
                className="w-full max-w-sm animate-fade-up rounded-[28px] border border-dashed border-outline-variant bg-surface-container-low p-8 text-center"
                style={{ animationDelay: "180ms" }}
              >
                <Vote className="mx-auto h-8 w-8 text-on-surface-variant" strokeWidth={1.8} />
                <p className="mt-4 text-xl font-medium text-on-surface">No election is live</p>
                <p className="mt-2 text-sm text-on-surface-variant">
                  When your Electoral Officer opens voting, it appears here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="border-b border-outline-variant bg-secondary-container py-3 text-on-secondary-container">
        <div className="container flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-[11px] font-medium uppercase tracking-[0.14em] sm:px-6">
          <span>Head Prefect</span>
          <span aria-hidden>•</span>
          <span>Sports Captain</span>
          <span aria-hidden>•</span>
          <span>Entertainment Prefect</span>
          <span aria-hidden>•</span>
          <span>Class Representative</span>
        </div>
      </div>

      <section className="container max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">How it works</p>
          <h2 className="mt-3 text-4xl font-normal leading-tight text-on-surface">Three steps, no arguments.</h2>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <UserCheck className="h-6 w-6" strokeWidth={2.2} />,
              step: "01",
              title: "Verify",
              body: "Your Electoral Officer adds every voter to the register using their index number and class. Only registered students can sign in, so nobody votes twice.",
            },
            {
              icon: <Vote className="h-6 w-6" strokeWidth={2.2} />,
              step: "02",
              title: "Vote",
              body: "Read the manifestos, pick one candidate per election and submit. Your choice is written once and cannot be edited or traced back to you.",
            },
            {
              icon: <Eye className="h-6 w-6" strokeWidth={2.2} />,
              step: "03",
              title: "See results",
              body: "When the Electoral Officer publishes, the tally appears instantly — votes, percentages and the winner, for everyone to check.",
            },
          ].map((item, index) => (
            <li
              key={item.step}
              className="animate-fade-up rounded-2xl border border-outline-variant bg-surface-container-low p-6 shadow-elev-1"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                  {item.icon}
                </span>
                <span className="text-3xl font-light text-on-surface/15">{item.step}</span>
              </div>
              <h3 className="mt-5 text-2xl font-normal text-on-surface">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-outline-variant bg-surface-container-low">
        <div className="container grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Built for trust</p>
            <h2 className="mt-3 text-4xl font-normal leading-tight text-on-surface">
              An election students believe in.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-on-surface-variant">
              Paper ballots get lost and group chats get screenshotted. OFKOSSEC keeps the whole process in
              one place, with rules enforced by the database rather than by trust.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {[
              {
                title: "One vote, enforced by the database",
                body: "A unique constraint on the ballot table makes a second vote from the same student impossible — even on two devices at once.",
              },
              {
                title: "Secret by design",
                body: "Individual ballots are never exposed. Only aggregated counts are released, and only after results are published.",
              },
              {
                title: "Run by your teachers",
                body: "Electoral Officers create the elections, manage candidates, and decide exactly when voting opens and results go public.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-4 rounded-2xl border border-outline-variant bg-surface-container p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2.4} />
                <div>
                  <h3 className="text-lg font-medium text-on-surface">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-12 text-on-primary shadow-elev-2 sm:px-12">
          <div className="halftone-poppy pointer-events-none absolute inset-0 opacity-15" aria-hidden />
          <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-4xl font-normal leading-tight">
                Ready when your school is.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-on-primary/80">
                The officer adds every voter in minutes, then students sign in with their index number and
                class.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/login"
                className={buttonClasses("primary", "lg", "bg-on-primary text-primary shadow-none hover:bg-on-primary/90")}
              >
                Sign in to vote
              </Link>
              <Link
                to="/officer/login"
                className={buttonClasses("outline", "lg", "border-on-primary/60 text-on-primary hover:bg-on-primary/10")}
              >
                Officer sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
