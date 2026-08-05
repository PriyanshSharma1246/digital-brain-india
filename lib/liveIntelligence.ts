export type LiveSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/** Result of a live web search attempt. */
export interface LiveSearchInfo {
  /** True when the query looks like it needs live data and a search was attempted. */
  shouldUseLiveInfo: boolean;
  /** Parsed results (empty when the search failed or returned nothing). */
  results: LiveSearchResult[];
  /** Prompt-ready context block (empty when no results). */
  context: string;
}

const CURRENT_TOPICS = [
  "government",
  "notification",
  "news",
  "weather",
  "economy",
  "stock",
  "public service",
  "scheme",
  "policy",
  "service",
];

const RECENT_QUERY_HINTS = [
  "latest",
  "recent",
  "today",
  "now",
  "current",
  "breaking",
  "new",
  "updated",
  "live",
];

export function looksLikeLiveQuery(message: string) {
  const normalized = message.toLowerCase();
  const hasLiveHint = RECENT_QUERY_HINTS.some((hint) => normalized.includes(hint));
  const hasTopic = CURRENT_TOPICS.some((topic) => normalized.includes(topic));
  const hasDateLike = /\b(today|yesterday|this week|this month|latest|current|now)\b/.test(normalized);
  return hasLiveHint || hasTopic || hasDateLike;
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractDuckDuckGoResults(html: string): LiveSearchResult[] {
  const results: LiveSearchResult[] = [];
  const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const titleHtml = match[2] ?? "";
    const title = cleanText(titleHtml.replace(/<[^>]+>/g, ""));
    const snippetMatch = html.slice(match.index).match(/<a class="result__snippet"[^>]*>(.*?)<\/a>/);
    const snippet = snippetMatch ? cleanText(snippetMatch[1].replace(/<[^>]+>/g, "")) : "";
    if (title && url) results.push({ title, url, snippet });
  }

  return results.slice(0, 4);
}

export async function searchLiveWeb(query: string): Promise<LiveSearchInfo> {
  if (!looksLikeLiveQuery(query)) {
    return { shouldUseLiveInfo: false, results: [] as LiveSearchResult[], context: "" };
  }

  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) {
      return { shouldUseLiveInfo: true, results: [], context: "" };
    }

    const html = await response.text();
    const results = extractDuckDuckGoResults(html);
    const context = results.length
      ? results
          .map((item, index) => `[${index + 1}] ${item.title}\nSource: ${item.url}\n${item.snippet}`)
          .join("\n\n")
      : "";

    return { shouldUseLiveInfo: true, results, context };
  } catch {
    return { shouldUseLiveInfo: true, results: [], context: "" };
  }
}
