import Link from "next/link";

const courses = [
  {
    title: "📚 AI Tutor",
    description: "Learn any subject with your personal AI teacher.",
  },
  {
    title: "🎥 Video Courses",
    description: "Access India's best educational videos.",
  },
  {
    title: "📝 Mock Tests",
    description: "Practice exams with AI-generated questions.",
  },
  {
    title: "📖 Notes",
    description: "Generate and save smart study notes instantly.",
  },
  {
    title: "🎯 Career Guidance",
    description: "Discover the best career path based on your skills.",
  },
  {
    title: "🤖 Ask AI",
    description: "Ask any educational question anytime.",
  },
];

export default function EducationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-10">
      <h1 className="text-5xl font-bold text-blue-400">
        📚 Education Hub
      </h1>

      <p className="mt-4 text-gray-400 text-lg">
        Empowering every student in India through Artificial Intelligence.
      </p>

      <div className="grid md:grid-cols-3 gap-8 mt-12">
        {courses.map((course) => (
          <div
            key={course.title}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-6 hover:border-blue-500 hover:scale-105 transition"
          >
            <h2 className="text-2xl font-bold">
              {course.title}
            </h2>

            <p className="mt-3 text-gray-400">
              {course.description}
            </p>

            <Link href="/education/ai-tutor">
  <button className="mt-6 bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg">
    Open
  </button>
</Link>
          </div>
        ))}
      </div>

      <Link href="/dashboard">
        <button className="mt-10 border border-gray-500 px-6 py-3 rounded-lg hover:bg-slate-800">
          ← Back to Dashboard
        </button>
      </Link>
    </div>
  );
}