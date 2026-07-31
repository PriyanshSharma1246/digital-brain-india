import Link from "next/link";

const services = [
  {
    title: "🌾 Crop Advisor",
    description: "Get AI recommendations for crops based on your location and season.",
  },
  {
    title: "🌦 Weather Forecast",
    description: "View weather updates that help in farming decisions.",
  },
  {
    title: "💹 Market Prices",
    description: "Check the latest crop prices from different markets.",
  },
  {
    title: "🐛 Crop Disease Detection",
    description: "Upload crop images for AI-based disease detection.",
  },
  {
    title: "💧 Irrigation Guide",
    description: "AI suggestions for efficient water usage.",
  },
  {
    title: "🚜 Government Schemes",
    description: "Discover agricultural schemes and subsidies.",
  },
];

export default function AgriculturePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-lime-400">
        🌾 Agriculture Hub
      </h1>

      <p className="mt-3 text-slate-400">
        Smart farming powered by AI.
      </p>

      <div className="grid gap-6 mt-10 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-lime-500 transition"
          >
            <h2 className="text-2xl font-bold">{service.title}</h2>

            <p className="mt-3 text-slate-400">
              {service.description}
            </p>

            <button className="mt-6 rounded-lg bg-lime-600 px-5 py-2 hover:bg-lime-700">
              Open
            </button>
          </div>
        ))}
      </div>

      <Link href="/dashboard">
        <button className="mt-10 rounded-lg border border-slate-700 px-6 py-3 hover:bg-slate-800">
          ← Back to Dashboard
        </button>
      </Link>
    </main>
  );
}