import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

/** Material 3 dialog. */
export function Modal({ open, title, onClose, children, footer, maxWidth = "max-w-md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-t-[28px] border border-outline-variant bg-surface-container-high shadow-elev-3 animate-slide-up sm:rounded-[28px] sm:animate-fade-up",
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <h3 className="text-xl font-medium leading-tight text-on-surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10 hover:text-on-surface"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="px-6 pb-4 pt-2">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 px-6 pb-6 pt-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
