type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

function formatEntry(entry: LogEntry) {
  return JSON.stringify(entry);
}

export function logEvent(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console[level](formatEntry({ level, message, context }));
    return;
  }

  console[level](formatEntry({ level, message, context }));
}

export function logError(message: string, context?: Record<string, unknown>) {
  logEvent("error", message, context);
}
