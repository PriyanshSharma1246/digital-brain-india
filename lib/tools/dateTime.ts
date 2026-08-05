import type { Tool, ToolResult } from "./types";

/**
 * Phase 7 — Date & Time Tool.
 *
 * Provides:
 *   - current date      ("what's the date today")
 *   - current time      ("what time is it")
 *   - weekday           ("what day is today")
 *   - timezone          ("what timezone are we in", "time in IST")
 *
 * The tool formats output for the Asia/Calcutta (India) locale by default and
 * includes a compact ISO timestamp plus the client-relevant timezone label.
 */

const TIMEZONE = "Asia/Calcutta";
const EN_IN_LOCALE = "en-IN";

/** Detects date/time requests. */
const DATE_TIME_PATTERNS = [
  /\b(?:what|whats|current|today'?s|now)\b.*\b(?:date|day|time|timezone|time zone|clock)\b/i,
  /\b(?:date|day|time|timezone|time zone)\b.*\b(?:today|now|current|right now|ist)\b/i,
  /\bwhat\s+day\s+is\s+it\b/i,
  /\bwhat\s+time\s+is\s+it\b/i,
  /\btoday'?s\s+(?:date|day)\b/i,
  /\bcurrent\s+(?:date|time|day|timezone)\b/i,
  /\bwhat\s+timezone\b/i,
  /\btime\s+in\s+(?:ist|india|delhi|mumbai|kolkata|chennai|bangalore|hyderabad)\b/i,
];

function canHandle(input: string): boolean {
  const text = input.toLowerCase();
  return DATE_TIME_PATTERNS.some((pattern) => pattern.test(text));
}

/** Formats an ISO weekday into a friendly label. */
function formatWeekday(date: Date): string {
  return date.toLocaleDateString(EN_IN_LOCALE, { weekday: "long", timeZone: TIMEZONE });
}

/** Formats the full date for the Asia/Calcutta timezone. */
function formatDate(date: Date): string {
  return date.toLocaleDateString(EN_IN_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TIMEZONE,
  });
}

/** Formats the current time for the Asia/Calcutta timezone. */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(EN_IN_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: TIMEZONE,
  });
}

/**
 * Detects the intended query type from the message so the output can be
 * tailored (e.g. timezone-only questions don't need the full date).
 */
function detectScope(input: string): "date" | "time" | "weekday" | "timezone" | "all" {
  const text = input.toLowerCase();

  if (/\b(timezone|time zone)\b/.test(text)) return "timezone";
  if (/\b(time\s+in|what\s+time|current\s+time|whats\s+the\s+time|\btime\b)\b/.test(text)) {
    if (/\b(?:date|day)\b/.test(text)) return "all";
    return "time";
  }
  if (/\bweekday|what\s+day\b/.test(text)) return "weekday";
  if (/\bdate\b|\btoday'?s\s+(?:date|day)\b|\bcurrent\s+date\b/.test(text)) {
    if (/\btime\b/.test(text)) return "all";
    return "date";
  }
  return "all";
}

async function execute(input: string): Promise<ToolResult> {
  const started = performance.now();
  const now = new Date();
  const scope = detectScope(input);

  const lines: string[] = [];
  let summary = "";

  switch (scope) {
    case "date":
      lines.push(`Today's date: ${formatDate(now)}.`);
      summary = `Date: ${formatDate(now)}`;
      break;
    case "time":
      lines.push(`Current time: ${formatTime(now)} (${TIMEZONE}).`);
      summary = `Time: ${formatTime(now)} (${TIMEZONE})`;
      break;
    case "weekday":
      lines.push(`Today is ${formatWeekday(now)}.`);
      summary = `Weekday: ${formatWeekday(now)}`;
      break;
    case "timezone": {
      const offsetMinutes = now.getTimezoneOffset();
      const offsetHours = Math.abs(Math.round(offsetMinutes / 60));
      const offsetLabel = offsetMinutes <= 0 ? `UTC+${offsetHours}` : `UTC-${offsetHours}`;
      lines.push(`Current timezone: ${TIMEZONE} (${offsetLabel}).`);
      lines.push(`Local time: ${formatTime(now)}.`);
      summary = `Timezone: ${TIMEZONE} (${offsetLabel})`;
      break;
    }
    default:
      lines.push(`Date: ${formatDate(now)}.`);
      lines.push(`Time: ${formatTime(now)} (${TIMEZONE}).`);
      lines.push(`Weekday: ${formatWeekday(now)}.`);
      lines.push(`Timezone: ${TIMEZONE}.`);
      summary = `${formatDate(now)}, ${formatTime(now)} (${TIMEZONE})`;
  }

  return {
    success: true,
    toolId: "date-time",
    output: lines.join(" "),
    metadata: {
      label: "🕒 Date & Time",
      summary,
      data: {
        iso: now.toISOString(),
        date: formatDate(now),
        time: formatTime(now),
        weekday: formatWeekday(now),
        timezone: TIMEZONE,
      },
    },
    executionTime: performance.now() - started,
  };
}

/** The Date & Time tool instance. */
export const dateTimeTool: Tool = {
  id: "date-time",
  name: "Date & Time",
  description:
    "Provides the current date, time, weekday, and timezone (India / Asia/Calcutta).",
  // Empty = available to all agents.
  enabledAgents: [],
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The date/time related question.",
      },
    },
    required: ["query"],
  },
  canHandle,
  execute,
};