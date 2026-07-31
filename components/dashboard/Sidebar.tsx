import Link from "next/link";

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: "🏠" },
  { name: "AI Chat", href: "/chat", icon: "🤖" },
  { name: "Education", href: "/education", icon: "📚" },
  { name: "Government", href: "/government", icon: "🏛" },
  { name: "Healthcare", href: "/healthcare", icon: "🏥" },
  { name: "Agriculture", href: "/agriculture", icon: "🌾" },
  { name: "Finance", href: "/finance", icon: "💰" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6">
      <h1 className="text-2xl font-bold text-blue-400">
        🇮🇳 India Digital Brain
      </h1>

      <nav className="mt-10 space-y-2">
        {menu.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-slate-800 transition"
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}