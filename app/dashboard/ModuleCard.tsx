type ModuleCardProps = {
  title: string;
  description: string;
  emoji: string;
};

export default function ModuleCard({
  title,
  description,
  emoji,
}: ModuleCardProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 transition hover:border-blue-500 hover:-translate-y-1 cursor-pointer">
      <div className="text-4xl">{emoji}</div>

      <h3 className="mt-4 text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-2 text-gray-400">
        {description}
      </p>
    </div>
  );
}
