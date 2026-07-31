import Link from "next/link";

const services = [
  {
    title: "🩺 AI Symptom Checker",
    description: "Describe your symptoms and get AI guidance.",
  },
  {
    title: "💊 Medicine Information",
    description: "Search medicines, dosage and precautions.",
  },
  {
    title: "🏥 Nearby Hospitals",
    description: "Find hospitals and emergency services.",
  },
];

export default function HealthcarePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-green-400">
        🏥 Healthcare Hub
      </h1>

      <div className="grid gap-6 mt-10 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h2 className="text-2xl font-bold">{service.title}</h2>

            <p className="mt-3 text-slate-400">
              {service.description}
            </p>
          </div>
        ))}
      </div>

      <Link href="/dashboard">
        <button className="mt-10 rounded-lg bg-green-600 px-5 py-2">
          Back to Dashboard
        </button>
      </Link>
    </main>
  );
}