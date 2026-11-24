import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/utils/format";

interface CandidateAvatarProps {
  name: string;
  photoUrl: string | null;
  className?: string;
  rounded?: boolean;
}

/**
 * Candidate portrait. Falls back to a Material tonal monogram if the image
 * never loads, so the card is never empty.
 */
export function CandidateAvatar({ name, photoUrl, className, rounded = false }: CandidateAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(photoUrl) && !failed;

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-outline-variant bg-surface-container-high",
        rounded ? "rounded-full" : "rounded-2xl",
        className,
      )}
    >
      {showImage ? (
        <img
          src={photoUrl as string}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-primary-container">
          <span className="text-2xl font-medium text-on-primary-container">{initials(name)}</span>
        </div>
      )}
    </div>
  );
}
