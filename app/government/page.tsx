import Link from "next/link";

const services = [
  {
    title: "🏛 Government Schemes",
    description: "Find central and state government schemes.",
  },
  {
    title: "📄 Documents",
    description: "Aadhaar, PAN, Passport, Driving License.",
  },
  {
    title: "🤖 AI Government Assistant",
    description: "Ask questions about government services.",
  },
  {
    title: "📢 Latest Updates",
    description: "Government announcements and notifications.",
  },
  {
    title: "🗳 Election Services",
    description: "Voter ID and election information.",
  },
  {
    title: "⚖ Citizen Services",
    description: "Access important public services.",
  },
];

export default function GovernmentPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-blue-400">
        🏛 Government Hub
      </h1>

      <p className="mt-3 text-slate-400">
        AI-powered government services for every citizen.
      </p>

      <div className="grid gap-6 mt-10 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-blue-500 transition"
          >
            <h2 className="text-2xl font-bold">{service.title}</h2>

            <p className="mt-3 text-slate-400">
              {service.description}
            </p>

            <button className="mt-6 rounded-lg bg-blue-600 px-5 py-2 hover:bg-blue-700">
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