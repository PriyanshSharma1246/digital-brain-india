import DashboardLayout from "@/components/dashboard/DashboardLayout";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickStats from "@/components/dashboard/QuickStats";
import ModuleCard from "@/components/dashboard/ModuleCard";

const modules = [
  {
    title: "AI Chat",
    description: "Talk with India Digital Brain",
    icon: "🤖",
    href: "/chat",
  },
  {
    title: "Education",
    description: "AI Tutor & Learning",
    icon: "📚",
    href: "/education",
  },
  {
    title: "Healthcare",
    description: "Medical AI Assistant",
    icon: "🏥",
    href: "/healthcare",
  },
  {
    title: "Government",
    description: "Government Services",
    icon: "🏛️",
    href: "/government",
  },
  {
    title: "Agriculture",
    description: "Farmer AI",
    icon: "🌾",
    href: "/agriculture",
  },
  {
    title: "Finance",
    description: "Financial AI",
    icon: "💰",
    href: "/finance",
  },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <WelcomeBanner />
      <QuickStats />

      <h2 className="text-3xl font-bold mb-6">
        AI Modules
      </h2>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <ModuleCard
            key={module.title}
            title={module.title}
            description={module.description}
            icon={module.icon}
            href={module.href}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}