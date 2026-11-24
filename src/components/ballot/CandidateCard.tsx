import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CandidateAvatar } from "@/components/ui/CandidateAvatar";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/types";

interface CandidateCardProps {
  candidate: Candidate;
  selected: boolean;
  disabled?: boolean;
  onSelect?: (candidateId: string) => void;
}

/**
 * Ballot ticket for one candidate. Renders as a radio option so the whole
 * group is keyboard navigable and screen-reader friendly.
 */
export function CandidateCard({ candidate, selected, disabled = false, onSelect }: CandidateCardProps) {
  const [manifestoOpen, setManifestoOpen] = useState(false);

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect?.(candidate.id)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onSelect?.(candidate.id);
        }
      }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-surface-container-low transition-[transform,box-shadow,border-color] duration-150",
        !disabled && "cursor-pointer hover:-translate-y-1 hover:shadow-elev-2",
        selected ? "border-tertiary shadow-elev-2 ring-2 ring-tertiary" : "border-outline-variant shadow-elev-1",
        disabled && "cursor-default opacity-90",
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 z-10 flex h-8 w-8 animate-stamp-in items-center justify-center rounded-full bg-tertiary text-on-tertiary shadow-elev-1">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
      )}

      <div className="flex items-center gap-4 border-b border-outline-variant p-4">
        <CandidateAvatar
          name={candidate.name}
          photoUrl={candidate.photo_url}
          className="h-20 w-20 shrink-0"
        />
        <div className="min-w-0">
          <h3 className="text-xl font-medium leading-tight text-on-surface">{candidate.name}</h3>
          {candidate.class_name && (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
              {candidate.class_name}
            </p>
          )}
          {candidate.slogan && (
            <p className="mt-2 text-sm italic leading-snug text-primary">“{candidate.slogan}”</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {candidate.manifesto ? (
          <>
            <p
              className={cn(
                "text-sm leading-relaxed text-on-surface-variant",
                !manifestoOpen && "line-clamp-3",
              )}
            >
              {candidate.manifesto}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setManifestoOpen((open) => !open);
              }}
              className="mt-3 inline-flex items-center gap-1 self-start text-[11px] font-medium uppercase tracking-[0.1em] text-tertiary transition-colors hover:text-primary"
              aria-expanded={manifestoOpen}
            >
              {manifestoOpen ? "Show less" : "Read manifesto"}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", manifestoOpen && "rotate-180")}
                strokeWidth={2.4}
              />
            </button>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">No manifesto submitted.</p>
        )}
      </div>

      {!disabled && (
        <div
          className={cn(
            "border-t px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.1em]",
            selected
              ? "border-tertiary bg-tertiary-container text-on-tertiary-container"
              : "border-outline-variant bg-surface-container text-on-surface-variant",
          )}
        >
          {selected ? "Selected" : "Tap to select"}
        </div>
      )}
    </div>
  );
}
