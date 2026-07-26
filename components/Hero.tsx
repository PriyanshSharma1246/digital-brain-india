export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center px-6 mt-32">
      <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
        🚀 India's AI Operating System
      </span>

      <h1 className="mt-8 text-6xl font-extrabold leading-tight">
        India's{" "}
        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Digital Brain
        </span>
      </h1>

      <p className="mt-8 max-w-3xl text-xl text-gray-300">
        Building the world's most intelligent AI platform dedicated to India—
        connecting knowledge, governance, education, healthcare, agriculture,
        finance, research, and innovation into one unified ecosystem.
      </p>

      <div className="mt-10 flex gap-6">
        <button className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold transition hover:scale-105 hover:bg-blue-700">
          Get Started
        </button>

        <button className="rounded-xl border border-white px-8 py-4 text-lg transition hover:bg-white hover:text-black">
          Learn More
        </button>
      </div>
    </section>
  );
}