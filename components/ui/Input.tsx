import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const sharedClasses =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** shadcn-style text input. */
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${sharedClasses} ${className}`} {...props} />;
}

/** shadcn-style textarea. */
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${sharedClasses} ${className}`} {...props} />;
}

/** shadcn-style select. */
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${sharedClasses} ${className}`} {...props}>
      {children}
    </select>
  );
}