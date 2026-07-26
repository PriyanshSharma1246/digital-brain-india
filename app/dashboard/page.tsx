import DashboardLayout from "./DashboardLayout";
import ModuleCard from "./ModuleCard";
export default function DashboardPage() {
  return (
    <DashboardLayout>
      <h1 className="text-4xl font-bold">
        Welcome to India Digital Brain
      </h1>

      <p className="mt-2 text-gray-400">
        Your AI-powered dashboard.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          emoji="🤖"
          title="AI Chat"
          description="Start talking with India's AI."
        />

        <ModuleCard
          emoji="🏛"
          title="Government"
          description="Government services and schemes."
        />

        <ModuleCard
          emoji="📚"
          title="Education"
          description="AI learning assistant."
        />

        <ModuleCard
          emoji="🏥"
          title="Healthcare"
          description="Healthcare information."
        />

        <ModuleCard
          emoji="🌾"
          title="Agriculture"
          description="Smart farming assistant."
        />

        <ModuleCard
          emoji="💰"
          title="Finance"
          description="Finance and investment AI."
        />
      </div>
    </DashboardLayout>
  );
}