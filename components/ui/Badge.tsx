type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  secondary: "bg-slate-800 text-slate-300 border-slate-700",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
};

/** shadcn-style badge (pill) primitive. */
export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}