const stats = [
  { value: "24/7", label: "AI access" },
  { value: "10+", label: "India-focused modules" },
  { value: "3", label: "Languages planned" },
];

export default function Stats() {
  return (
    <section className="mx-auto mt-24 max-w-7xl px-8">
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-lg shadow-black/20"
          >
            <div className="text-4xl font-extrabold text-blue-400">
              {item.value}
            </div>
            <div className="mt-2 text-gray-300">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}