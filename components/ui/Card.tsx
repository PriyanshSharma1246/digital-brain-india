type CardProps = {
  children: React.ReactNode;
  className?: string;
};

/** A reusable surface container matching the project's dark dashboard theme. */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: CardProps) {
  return <h2 className={`text-xl font-semibold text-slate-100 ${className}`}>{children}</h2>;
}

export function CardDescription({ children, className = "" }: CardProps) {
  return <p className={`mt-1 text-sm text-slate-400 ${className}`}>{children}</p>;
}