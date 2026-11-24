import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  Mail,
  Pencil,
  Vote,
} from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState, PageLoader } from "@/components/ui/Feedback";
import { RoleChip, StatusChip } from "@/components/ui/StatusChip";
import { useAuthStore, useIsAdmin } from "@/store/authStore";
import { useVotingHistory } from "@/hooks/useElections";
import { formatDate, initials } from "@/utils/format";

export default function Profile() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const profileLoading = useAuthStore((state) => state.profileLoading);
  const signOut = useAuthStore((state) => state.signOut);
  const isAdmin = useIsAdmin();
  const { items, loading } = useVotingHistory();

  const displayName = profile?.full_name ?? "Student";

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <PageHeading
          eyebrow="My ballot"
          title="Your account"
          description="Your details and the elections you have already voted in."
          actions={
            <button
              type="button"
              onClick={() => void signOut()}
              className={buttonClasses("outline", "md")}
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
              Sign out
            </button>
          }
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="flex flex-col gap-4">
            <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-6 shadow-elev-1">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-2xl font-medium text-on-primary-container">
                  {initials(displayName)}
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-normal leading-tight text-on-surface">{displayName}</h2>
                  <div className="mt-2">
                    <RoleChip role={isAdmin ? "admin" : "student"} />
                  </div>
                </div>
              </div>

              <dl className="mt-6 flex flex-col gap-3.5 border-t border-dashed border-outline-variant pt-5">
                <DetailRow icon={<Mail className="h-4 w-4" strokeWidth={2.2} />} label="Email">
                  {session?.user.email ?? "—"}
                </DetailRow>
                <DetailRow icon={<IdCard className="h-4 w-4" strokeWidth={2.2} />} label="Student ID">
                  {profile?.student_id ?? "Not set"}
                </DetailRow>
                <DetailRow icon={<GraduationCap className="h-4 w-4" strokeWidth={2.2} />} label="Class">
                  {profile?.class_name ?? "Not set"}
                </DetailRow>
                <DetailRow icon={<CalendarDays className="h-4 w-4" strokeWidth={2.2} />} label="Joined">
                  {profile?.created_at ? formatDate(profile.created_at) : "—"}
                </DetailRow>
              </dl>

              {profileLoading && !profile && (
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                  Syncing profile…
                </p>
              )}
            </div>

            {isAdmin && (
              <Link
                to="/admin"
                className="group flex items-center justify-between gap-4 rounded-2xl bg-tertiary-container px-5 py-4 text-on-tertiary-container shadow-elev-1 transition-shadow hover:shadow-elev-2"
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard className="h-5 w-5" strokeWidth={2.2} />
                  <span className="text-lg font-medium">Officer panel</span>
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
              </Link>
            )}

            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container p-5 text-sm text-on-surface-variant">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em]">
                <BadgeCheck className="h-4 w-4 text-tertiary" strokeWidth={2.2} />
                Ballot privacy
              </p>
              <p className="mt-2 leading-relaxed">
                We record that you voted, but never which candidate you chose. Your selection is not visible
                to officers or other students.
              </p>
            </div>
          </aside>

          <section>
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-outline-variant pb-4">
              <div>
                <h2 className="text-2xl font-normal text-on-surface">Voting history</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {loading ? "Loading…" : `${items.length} election${items.length === 1 ? "" : "s"} voted in.`}
                </p>
              </div>
              <Link to="/elections" className={buttonClasses("primary", "sm")}>
                <Vote className="h-3.5 w-3.5" strokeWidth={2.4} />
                Open ballots
              </Link>
            </div>

            {loading ? (
              <PageLoader label="Loading your history" />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Vote className="h-6 w-6" strokeWidth={2.2} />}
                title="You have not voted yet"
                description="Once you cast your first ballot, it will appear here."
                action={
                  <Link to="/elections" className={buttonClasses("outline", "md")}>
                    See open elections
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map(({ election, createdAt, canChange }) => (
                  <li
                    key={election.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-elev-1"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-tertiary" strokeWidth={2.4} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                          {election.position}
                        </p>
                        <p className="mt-0.5 text-lg font-medium leading-tight text-on-surface">
                          {election.title}
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Voted on {formatDate(createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusChip status={election.status} resultsPublic={election.results_public} />
                      {canChange && (
                        <Link
                          to={`/elections/${election.id}?edit=1`}
                          className={buttonClasses("outline", "sm")}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                          Change my vote
                        </Link>
                      )}
                      {election.status !== "active" && election.results_public && (
                        <Link
                          to={`/elections/${election.id}/results`}
                          className={buttonClasses("outline", "sm")}
                        >
                          Results
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-right text-sm font-medium text-on-surface">{children}</dd>
    </div>
  );
}
