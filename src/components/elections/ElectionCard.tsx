import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, Home, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { describeDeadline, pluralise } from "@/utils/format";
import type { ElectionSummary } from "@/types";
import { cn } from "@/lib/utils";

export function ElectionCard({ election }: { election: ElectionSummary }) {
  const isLive = election.status === "active";

  return (
    <Card
      raised
      className={cn(
        "group flex flex-col overflow-hidden transition-shadow duration-150 hover:shadow-elev-2",
        isLive && "border-l-4 border-l-primary",
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            {election.position}
          </p>
          <StatusChip status={election.status} resultsPublic={election.results_public} />
        </div>

        <h3 className="mt-3 text-2xl font-normal leading-tight text-on-surface">
          <Link to={`/elections/${election.id}`} className="after:absolute after:inset-0">
            {election.title}
          </Link>
        </h3>

        {election.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{election.description}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed border-outline-variant pt-4 text-[11px] font-medium text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" strokeWidth={2.2} />
            {pluralise(election.candidateCount, "candidate")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.2} />
            {describeDeadline(election)}
          </span>
          {election.eligible_gender !== "any" && (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Users className="h-3.5 w-3.5" strokeWidth={2.2} />
              Open to {election.eligible_gender} students only
            </span>
          )}
          {election.eligible_house && (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Home className="h-3.5 w-3.5" strokeWidth={2.2} />
              Open to {election.eligible_house} only
            </span>
          )}
          {election.hasVoted && (
            <span className="inline-flex items-center gap-1.5 text-tertiary">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
              You voted
            </span>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-between border-t border-outline-variant bg-surface-container px-5 py-3 text-primary">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em]">
          {isLive ? "Cast your vote" : "View election"}
        </span>
        <ArrowRight
          className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
          strokeWidth={2.4}
        />
      </div>
    </Card>
  );
}
