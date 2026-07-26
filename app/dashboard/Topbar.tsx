export default function Topbar() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 p-6">
      <input
        placeholder="Search anything..."
        className="w-96 rounded-lg bg-slate-800 px-4 py-2 outline-none"
      />

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">Priyansh</p>
          <p className="text-sm text-gray-400">
            India Digital Brain
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
          P
        </div>
      </div>
    </header>
  );
}