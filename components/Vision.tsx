export default function Vision() {
  return (
    <section className="mx-auto mt-32 max-w-7xl px-8">
      <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-r from-slate-900 to-slate-800 p-12">

        <p className="text-blue-400 font-semibold uppercase tracking-widest">
          OUR VISION
        </p>

        <h2 className="mt-4 text-5xl font-extrabold">
          Building India&apos;s AI Brain
        </h2>

        <p className="mt-8 text-lg leading-8 text-gray-300 max-w-4xl">
          India Digital Brain is an ambitious AI platform that unifies
          education, healthcare, governance, agriculture, finance, research,
          legal information and innovation into one intelligent ecosystem.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">

          <div className="rounded-2xl bg-slate-900/70 p-6">
            <h3 className="text-2xl font-bold">
              🧠 AI Knowledge Engine
            </h3>

            <p className="mt-3 text-gray-400">
              Ask anything about India and receive intelligent,
              trustworthy answers powered by AI.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-6">
            <h3 className="text-2xl font-bold">
              🇮🇳 One Platform
            </h3>

            <p className="mt-3 text-gray-400">
              Government, education, healthcare, research,
              agriculture and finance in one ecosystem.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}