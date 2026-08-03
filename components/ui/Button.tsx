"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 disabled:pointer-events-none";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-100",
  danger: "bg-red-600/80 hover:bg-red-600 text-white",
  ghost: "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

/**
 * shadcn-style button primitive. Extends the native button element so it can
 * be used with both `onClick` handlers and `type="submit"` forms.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

// Backward-compatible default export for existing callers (e.g. components/Hero).
export default Button;
