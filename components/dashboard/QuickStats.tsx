export default function QuickStats() {
  const stats = [
    {
      title: "AI Modules",
      value: "12",
      color: "text-blue-400",
    },
    {
      title: "Users",
      value: "1,254",
      color: "text-green-400",
    },
    {
      title: "AI Requests",
      value: "48K",
      color: "text-yellow-400",
    },
    {
      title: "System Status",
      value: "Online",
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="rounded-2xl bg-slate-900 border border-slate-800 p-6"
        >
          <p className="text-sm text-slate-400">{stat.title}</p>

          <h2 className={`text-3xl font-bold mt-2 ${stat.color}`}>
            {stat.value}
          </h2>
        </div>
      ))}
    </div>
  );
}