import type { AgentId } from "@/lib/agents";
import { AGENT_DEFINITIONS } from "@/lib/agents";

/**
 * Phase 6 — Agent Router.
 *
 * Determines which agent should answer a user query using keyword scoring.
 * The router is intentionally modular: it exposes a single `routeQuery`
 * function that returns the best agent id. A future AI classifier can replace
 * the scoring internals without changing the public API.
 */

/** A single routing rule: a set of keywords that boost a candidate agent. */
interface RoutingRule {
  agentId: AgentId;
  /** Keywords that strongly indicate this agent (higher weight). */
  strongKeywords: string[];
  /** Keywords that weakly indicate this agent (lower weight). */
  weakKeywords: string[];
}

/** Weight applied to a strong keyword match. */
const STRONG_WEIGHT = 3;
/** Weight applied to a weak keyword match. */
const WEAK_WEIGHT = 1;
/** Minimum score required to beat the general fallback. */
const MIN_SPECIALIST_SCORE = 2;

/**
 * Routing rules. Each agent lists strong and weak keywords. The router
 * scores every agent and picks the highest-scoring specialist; if no
 * specialist reaches the threshold, the general agent is returned.
 */
const ROUTING_RULES: RoutingRule[] = [
  {
    agentId: "agriculture",
    strongKeywords: [
      "crop",
      "farmer",
      "agriculture",
      "farming",
      "kisan",
      "irrigation",
      "soil",
      "fertilizer",
      "pesticide",
      "harvest",
      "pm-kisan",
      "kcc",
      "pmfby",
      "mandi",
      "agri",
    ],
    weakKeywords: [
      "rural",
      "livelihood",
      "seed",
      "monsoon",
      "organic",
      "dairy",
      "poultry",
    ],
  },
  {
    agentId: "government",
    strongKeywords: [
      "government",
      "scheme",
      "aadhaar",
      "pan card",
      "digilocker",
      "subsidy",
      "welfare",
      "policy",
      "citizen",
      "mygov",
      "pm scheme",
      "benefit",
      "eligibility",
      "application",
    ],
    weakKeywords: [
      "ministry",
      "act",
      "law",
      "rights",
      "document",
      "certificate",
      "portal",
    ],
  },
  {
    agentId: "healthcare",
    strongKeywords: [
      "hospital",
      "doctor",
      "medicine",
      "health",
      "disease",
      "vaccine",
      "ayushman",
      "pmjay",
      "treatment",
      "symptom",
      "nutrition",
      "wellness",
      "clinic",
      "pharmacy",
    ],
    weakKeywords: [
      "fever",
      "diabetes",
      "blood",
      "heart",
      "mental health",
      "pregnancy",
      "child health",
    ],
  },
  {
    agentId: "education",
    strongKeywords: [
      "study",
      "exam",
      "college",
      "education",
      "school",
      "university",
      "scholarship",
      "admission",
      "nep",
      "ugc",
      "aicte",
      "syllabus",
      "degree",
      "course",
      "student",
    ],
    weakKeywords: [
      "learn",
      "teacher",
      "tuition",
      "online course",
      "entrance",
      "jee",
      "neet",
      "upsc",
    ],
  },
  {
    agentId: "employment",
    strongKeywords: [
      "job",
      "employment",
      "career",
      "resume",
      "interview",
      "salary",
      "mgnrega",
      "skill india",
      "pmkvy",
      "workforce",
      "hiring",
      "vacancy",
      "recruitment",
    ],
    weakKeywords: [
      "work",
      "profession",
      "freelance",
      "internship",
      "apprenticeship",
      "training",
    ],
  },
  {
    agentId: "finance",
    strongKeywords: [
      "money",
      "loan",
      "investment",
      "finance",
      "bank",
      "savings",
      "tax",
      "budget",
      "upi",
      "insurance",
      "interest",
      "credit",
      "debt",
      "rbi",
      "sebi",
      "income tax",
      "gst",
    ],
    weakKeywords: [
      "payment",
      "salary",
      "expense",
      "wealth",
      "stock",
      "mutual fund",
      "fixed deposit",
    ],
  },
];

/** Result of a routing decision. */
export interface RouteResult {
  /** The agent selected to answer the query. */
  agentId: AgentId;
  /** The score that led to this selection (0 for general fallback). */
  score: number;
  /** True when the router made a specialist decision (not the fallback). */
  isSpecialist: boolean;
}

/**
 * Scores a single agent against the query text.
 * Returns the sum of strong keyword hits (×3) and weak keyword hits (×1).
 */
function scoreAgent(agentId: AgentId, text: string): number {
  const rule = ROUTING_RULES.find((r) => r.agentId === agentId);
  if (!rule) return 0;

  let score = 0;
  for (const keyword of rule.strongKeywords) {
    if (text.includes(keyword)) score += STRONG_WEIGHT;
  }
  for (const keyword of rule.weakKeywords) {
    if (text.includes(keyword)) score += WEAK_WEIGHT;
  }
  return score;
}

/**
 * Routes a user query to the best agent.
 *
 * The router normalizes the query to lowercase, scores every specialist
 * agent, and returns the highest-scoring one that meets the minimum
 * threshold. If no specialist qualifies, the general agent is returned.
 *
 * This function is synchronous and side-effect free, making it easy to
 * replace with an AI classifier later (the classifier would simply return
 * the same `RouteResult` shape).
 */
export function routeQuery(message: string): RouteResult {
  const text = message.toLowerCase();

  let bestAgent: AgentId = "general";
  let bestScore = 0;

  for (const rule of ROUTING_RULES) {
    const score = scoreAgent(rule.agentId, text);
    if (score > bestScore) {
      bestScore = score;
      bestAgent = rule.agentId;
    }
  }

  const isSpecialist = bestScore >= MIN_SPECIALIST_SCORE;

  return {
    agentId: isSpecialist ? bestAgent : "general",
    score: isSpecialist ? bestScore : 0,
    isSpecialist,
  };
}

/**
 * Legacy helper retained for backward compatibility with existing callers.
 * Returns the agent id string (e.g. "education") or "general".
 */
export function detectModule(message: string): string {
  return routeQuery(message).agentId;
}

/** Returns the list of agent ids the router can select (for UI/testing). */
export function getRoutableAgentIds(): AgentId[] {
  return AGENT_DEFINITIONS.map((agent) => agent.id);
}