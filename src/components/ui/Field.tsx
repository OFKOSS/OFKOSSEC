import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/** Material 3 outlined text-field surface. */
const CONTROL_BASE =
  "w-full rounded-lg border border-outline bg-transparent px-4 py-3 font-sans text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 hover:border-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-on-surface/5 disabled:text-on-surface-variant";

const SELECT_CHEVRON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23938F99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1 font-sans text-sm font-medium text-on-surface-variant"
      >
        {label}
        {required && <span className="text-error">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_BASE, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_BASE, "resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      style={{
        backgroundImage: `url("${SELECT_CHEVRON}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.85rem center",
        backgroundSize: "1.1rem",
      }}
      className={cn(CONTROL_BASE, "cursor-pointer appearance-none pr-10", className)}
      {...props}
    >
      {children}
    </select>
  );
}
