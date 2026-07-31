export default function AITutorPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-blue-400">
        🤖 AI Tutor
      </h1>

      <p className="mt-4 text-gray-400 text-lg">
        Ask any question and your AI tutor will explain it step-by-step.
      </p>

      <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-8">
        <textarea
          placeholder="Ask your study question..."
          className="w-full h-40 rounded-xl bg-slate-800 p-4 outline-none"
        />

        <button className="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg">
          Ask AI
        </button>
      </div>
    </main>
  );
}