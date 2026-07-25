export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <nav className="flex items-center justify-between px-10 py-6">
        <h1 className="text-2xl font-bold text-blue-400">
          🇮🇳 India Digital Brain
        </h1>

        <div className="space-x-6">
          <button className="hover:text-blue-400">Home</button>
          <button className="hover:text-blue-400">About</button>
          <button className="hover:text-blue-400">Features</button>
          <button className="hover:text-blue-400">Contact</button>
        </div>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 mt-32">
        <h1 className="text-6xl font-extrabold leading-tight">
          India's <span className="text-blue-500">Digital Brain</span>
        </h1>

        <p className="mt-8 max-w-3xl text-xl text-gray-300">
          An AI-powered platform designed to become India's intelligent
          knowledge engine—bringing together government information,
          education, healthcare, agriculture, finance, research, and much
          more in one place.
        </p>

        <div className="mt-10 flex gap-6">
          <button className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold hover:bg-blue-700">
            Get Started
          </button>

          <button className="rounded-xl border border-white px-8 py-4 text-lg hover:bg-white hover:text-black">
            Learn More
          </button>
        </div>
      </section>
    </main>
  );
}