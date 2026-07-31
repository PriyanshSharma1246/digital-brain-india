import Link from "next/link";

const services = [
  {
    title: "💰 Budget Planner",
    description: "Track your income and expenses with AI assistance.",
  },
  {
    title: "📈 Investment Advisor",
    description: "Learn about investing and understand different options.",
  },
  {
    title: "💳 Loan Calculator",
    description: "Estimate EMI and repayment schedules.",
  },
  {
    title: "📊 Expense Analytics",
    description: "Visualise your spending habits with charts.",
  },
  {
    title: "💼 Tax Assistant",
    description: "Understand basic tax concepts and deductions.",
  },
  {
    title: "🤖 AI Financial Advisor",
    description: "Ask AI questions about budgeting and personal finance.",
  },
];

export default function FinancePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-yellow-400">
        💰 Finance Hub
      </h1>

      <p className="mt-3 text-slate-400">
        Manage your finances with AI-powered insights.
      </p>

      <div className="grid gap-6 mt-10 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-yellow-500 transition"
          >
            <h2 className="text-2xl font-bold">{service.title}</h2>

            <p className="mt-3 text-slate-400">
              {service.description}
            </p>

            <button className="mt-6 rounded-lg bg-yellow-500 text-black px-5 py-2 hover:bg-yellow-400">
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