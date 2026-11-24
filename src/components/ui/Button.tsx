import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "cobalt" | "outline" | "ink" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Material 3 buttons. The variant names predate the redesign, so they map onto
 * the Material roles: primary = filled, cobalt = tonal, outline = outlined,
 * ink = filled on dark, ghost = text button.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-elev-0 hover:bg-primary-hover hover:shadow-elev-1 active:shadow-elev-0",
  cobalt:
    "bg-tertiary-container text-on-tertiary-container shadow-elev-0 hover:shadow-elev-1 hover:brightness-[0.97] active:shadow-elev-0",
  outline:
    "border border-outline bg-transparent text-primary hover:bg-primary/10 active:bg-primary/15",
  ink: "bg-on-surface text-surface shadow-elev-0 hover:shadow-elev-1 hover:opacity-90 active:shadow-elev-0",
  ghost: "bg-transparent text-primary hover:bg-primary/10 active:bg-primary/15",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-10 px-6 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-medium tracking-[0.1px] transition-[background-color,box-shadow,color,filter] duration-200 disabled:cursor-not-allowed disabled:bg-on-surface/10 disabled:text-on-surface/40 disabled:shadow-none disabled:hover:bg-on-surface/10",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", icon, children, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </button>
  );
});
