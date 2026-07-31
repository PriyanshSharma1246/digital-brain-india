/**
 * Animated "AI is typing" indicator shown while waiting for the API response.
 * Three jumping dots, matching the assistant bubble style.
 */
export default function TypingBubble() {
  return (
    <div className="group flex w-full items-start gap-3">
      {/* Avatar */}
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-blue-400 ring-1 ring-slate-700">
        AI
      </div>

      <div className="flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]">
        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-slate-800 px-4 py-4 ring-1 ring-slate-700">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="inline-block h-2 w-2 animate-bounce rounded-full bg-slate-400"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}