import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { CandidateAvatar } from "@/components/ui/CandidateAvatar";
import { cn } from "@/lib/utils";
import { percent, pluralise } from "@/utils/format";
import type { ElectionResultRow } from "@/types";

interface ResultsTallyProps {
  rows: ElectionResultRow[];
  totalVotes: number;
}

export function ResultsTally({ rows, totalVotes }: ResultsTallyProps) {
  const topCount = rows.length ? Math.max(...rows.map((row) => row.vote_count)) : 0;
  const isTie = rows.filter((row) => row.vote_count === topCount && topCount > 0).length > 1;

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <ResultRow
          key={row.candidate_id}
          row={row}
          totalVotes={totalVotes}
          rank={index + 1}
          isLeader={!isTie && row.vote_count === topCount && topCount > 0}
        />
      ))}
    </div>
  );
}

function ResultRow({
  row,
  totalVotes,
  rank,
  isLeader,
}: {
  row: ElectionResultRow;
  totalVotes: number;
  rank: number;
  isLeader: boolean;
}) {
  const [width, setWidth] = useState(0);
  const share = percent(row.vote_count, totalVotes);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(share));
    return () => cancelAnimationFrame(frame);
  }, [share]);

  return (
    <div
      className={cn(
        "animate-fade-up rounded-2xl border border-outline-variant bg-surface-container-low p-4",
        isLeader ? "shadow-elev-2" : "shadow-elev-1",
      )}
    >
      <div className="flex items-center gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-medium text-on-surface">
          {rank}
        </span>
        <CandidateAvatar name={row.candidate_name} photoUrl={row.photo_url} className="h-12 w-12 shrink-0" rounded />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium leading-tight text-on-surface">{row.candidate_name}</h3>
            {isLeader && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-on-primary-container">
                <Trophy className="h-3 w-3" strokeWidth={2.4} />
                Leading
              </span>
            )}
          </div>
          {row.class_name && (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              {row.class_name}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-normal leading-none text-on-surface">{share}%</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            {pluralise(row.vote_count, "vote")}
          </p>
        </div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", isLeader ? "bg-primary" : "bg-tertiary")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function WinnerCallout({ row, totalVotes }: { row: ElectionResultRow; totalVotes: number }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-primary p-6 text-on-primary shadow-elev-2">
      <span className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-on-primary/15 text-on-primary">
        <Trophy className="h-6 w-6" strokeWidth={2.2} />
      </span>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-primary/70">Declared winner</p>
      <h2 className="mt-2 text-3xl font-normal leading-tight">{row.candidate_name}</h2>
      {row.class_name && (
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-on-primary/70">{row.class_name}</p>
      )}
      <p className="mt-4 text-sm text-on-primary/85">
        {pluralise(row.vote_count, "vote")} — {percent(row.vote_count, totalVotes)}% of the
        {" "}
        {pluralise(totalVotes, "ballot")} cast.
      </p>
    </div>
  );
}
