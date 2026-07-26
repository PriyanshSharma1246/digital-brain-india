export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-10 py-6">
      <h1 className="text-2xl font-bold text-blue-400">
        🇮🇳 India Digital Brain
      </h1>

      <div className="space-x-6">
        <button className="hover:text-blue-400 transition">Home</button>
        <button className="hover:text-blue-400 transition">About</button>
        <button className="hover:text-blue-400 transition">Features</button>
        <button className="hover:text-blue-400 transition">Contact</button>
      </div>
    </nav>
  );
}