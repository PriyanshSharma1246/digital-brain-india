const features = [
  {
    title: "🧠 AI Knowledge Engine",
    description:
      "Get intelligent answers about India using advanced AI and trusted knowledge sources.",
  },
  {
    title: "🏛 Government Services",
    description:
      "Find schemes, policies, documents, and citizen services from one place.",
  },
  {
    title: "🌐 Multi-language AI",
    description:
      "Interact with the Digital Brain in English, Hindi, and other Indian languages.",
  },
];

export default function Features() {
  return (
    <section className="mx-auto mt-32 max-w-7xl px-8">
      <h2 className="mb-12 text-center text-4xl font-bold">
        Why India Digital Brain?
      </h2>

      <div className="grid gap-8 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-8 transition hover:-translate-y-2 hover:border-blue-500"
          >
            <h3 className="mb-4 text-2xl font-bold">{feature.title}</h3>
            <p className="text-gray-300">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}