import Link from "next/link";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
}

export default function ModuleCard({
  title,
  description,
  icon,
  href,
}: ModuleCardProps) {
  return (
    <Link href={href}>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-blue-500 hover:scale-105 transition-all cursor-pointer">
        <div className="text-5xl">{icon}</div>

        <h2 className="mt-4 text-2xl font-bold">
          {title}
        </h2>

        <p className="mt-2 text-slate-400">
          {description}
        </p>
      </div>
    </Link>
  );
}