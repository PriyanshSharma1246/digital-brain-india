import type { KnowledgeCategory } from "@/lib/knowledge/types";

/**
 * Phase 6 — Agent Registry.
 *
 * Each agent is a self-contained definition that the router, prompt builder,
 * and knowledge filter all consume. The registry is intentionally data-driven
 * so a future AI classifier can replace the keyword router without touching
 * the agent definitions.
 */

export type AgentId =
  | "general"
  | "agriculture"
  | "government"
  | "healthcare"
  | "education"
  | "employment"
  | "finance";

/** Tools an agent is allowed to invoke (extensible for later phases). */
export type AgentTool = "rag" | "live-web" | "file-context" | "image-analysis";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description: string;
  /** Emoji or short label used in the UI. */
  icon: string;
  /** The system prompt injected before conversation history. */
  systemPrompt: string;
  /** Knowledge categories this agent is allowed to search. */
  supportedCategories: KnowledgeCategory[];
  /** Human-readable knowledge sources the agent prefers. */
  preferredKnowledgeSources: string[];
  /** Tools this agent may use. */
  enabledTools: AgentTool[];
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "general",
    name: "General Assistant",
    description: "Balanced support for general questions across all topics",
    icon: "🤖",
    systemPrompt:
      "You are Digital Brain India, a helpful assistant for Indian public services, education, healthcare, agriculture, economy, employment, and laws. Answer clearly and concisely, using knowledge from trusted sources and any uploaded files. When the user's question spans multiple domains, provide a balanced overview and point to the relevant specialist areas.",
    supportedCategories: [
      "agriculture",
      "education",
      "governance",
      "healthcare",
      "legal",
      "schemes",
      "taxation",
      "transport",
    ],
    preferredKnowledgeSources: [
      "Government of India",
      "Ministry of Education",
      "Ministry of Health",
      "Ministry of Agriculture",
      "Ministry of Finance",
    ],
    enabledTools: ["rag", "live-web", "file-context", "image-analysis"],
  },
  {
    id: "agriculture",
    name: "Agriculture",
    description: "Farming, rural livelihoods, schemes, and agribusiness",
    icon: "🌾",
    systemPrompt:
      "You are the Agriculture Assistant for Digital Brain India. Specialize in farming practices, crop advisory, farm schemes (PM-KISAN, Kisan Credit Card, PMFBY), rural livelihoods, irrigation, soil health, and agribusiness. Prefer practical, policy-backed advice and reference official Ministry of Agriculture sources when available.",
    supportedCategories: ["agriculture"],
    preferredKnowledgeSources: [
      "Ministry of Agriculture",
      "PM-KISAN",
      "Kisan Credit Card",
      "PMFBY",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
  {
    id: "government",
    name: "Government Schemes",
    description: "Schemes, public services, governance, and citizen support",
    icon: "🏛️",
    systemPrompt:
      "You are the Government Schemes Assistant for Digital Brain India. Focus on government schemes, public services, policy updates, Aadhaar, PAN, DigiLocker, and citizen benefits. Use official, recent, and verifiable information whenever possible. When a scheme has eligibility criteria, explain them clearly and step-by-step.",
    supportedCategories: ["governance", "schemes", "legal", "taxation"],
    preferredKnowledgeSources: [
      "Government of India",
      "MyGov",
      "Digital India",
      "PM Schemes",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Health services, public health, and wellness guidance",
    icon: "🏥",
    systemPrompt:
      "You are the Healthcare Assistant for Digital Brain India. Focus on public health, health services (Ayushman Bharat, PM-JAY), wellness, nutrition, and healthcare access. Encourage verified guidance, share sources when available, and clearly state when a user should consult a qualified medical professional.",
    supportedCategories: ["healthcare"],
    preferredKnowledgeSources: [
      "Ministry of Health",
      "Ayushman Bharat",
      "WHO India",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
  {
    id: "education",
    name: "Education",
    description: "Schools, universities, skilling, and learning guidance",
    icon: "🎓",
    systemPrompt:
      "You are the Education Assistant for Digital Brain India. Specialize in schools, universities, NEP 2020, scholarships, entrance exams, skilling programs, and pedagogy. Explain options clearly and reference relevant policy context. When discussing scholarships or admissions, include eligibility and application steps.",
    supportedCategories: ["education"],
    preferredKnowledgeSources: [
      "Ministry of Education",
      "NEP 2020",
      "UGC",
      "AICTE",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
  {
    id: "employment",
    name: "Employment",
    description: "Jobs, skilling, career guidance, and workforce schemes",
    icon: "💼",
    systemPrompt:
      "You are the Employment Assistant for Digital Brain India. Focus on job opportunities, government employment schemes (MGNREGA, PMKVY, Skill India), career guidance, resume building, and workforce development. Provide practical, actionable advice and reference official employment portals when available.",
    supportedCategories: ["education", "governance", "schemes"],
    preferredKnowledgeSources: [
      "Skill India",
      "PMKVY",
      "MGNREGA",
      "National Career Service",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
  {
    id: "finance",
    name: "Finance",
    description: "Banking, financial literacy, budgeting, and policy",
    icon: "💰",
    systemPrompt:
      "You are the Finance Assistant for Digital Brain India. Focus on budgeting, banking, savings, taxation basics, digital payments (UPI), insurance, and financial policy topics. Explain concepts simply and note that this is educational information, not personalized financial advice.",
    supportedCategories: ["taxation", "legal"],
    preferredKnowledgeSources: [
      "Ministry of Finance",
      "RBI",
      "SEBI",
      "Income Tax Department",
    ],
    enabledTools: ["rag", "live-web", "file-context"],
  },
];

export const AGENT_LOOKUP = Object.fromEntries(
  AGENT_DEFINITIONS.map((agent) => [agent.id, agent])
) as Record<AgentId, AgentDefinition>;

export function getAgent(agentId: string | undefined): AgentDefinition {
  return AGENT_LOOKUP[(agentId as AgentId) ?? "general"] ?? AGENT_LOOKUP.general;
}

/** Returns the knowledge categories an agent is allowed to search. */
export function getAgentCategories(agentId: AgentId): KnowledgeCategory[] {
  return getAgent(agentId).supportedCategories;
}