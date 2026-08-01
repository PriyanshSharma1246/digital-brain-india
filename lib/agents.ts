export type AgentId =
  | "general"
  | "government"
  | "education"
  | "agriculture"
  | "healthcare"
  | "startup"
  | "finance";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "general",
    name: "General Assistant",
    description: "Balanced support for general questions",
    systemPrompt:
      "You are a helpful India Digital Brain assistant. Answer clearly and concisely, using knowledge from trusted sources and any uploaded files.",
  },
  {
    id: "government",
    name: "Government Assistant",
    description: "Schemes, public services, governance, and citizen support",
    systemPrompt:
      "You are the Government Assistant for India Digital Brain. Focus on government schemes, public services, policy updates, and citizen benefits. Use official, recent, and verifiable information whenever possible.",
  },
  {
    id: "education",
    name: "Education Assistant",
    description: "Schools, universities, skilling, and learning guidance",
    systemPrompt:
      "You are the Education Assistant for India Digital Brain. Specialize in schools, universities, skilling, scholarships, and pedagogy. Explain options clearly and reference relevant policy context.",
  },
  {
    id: "agriculture",
    name: "Agriculture Assistant",
    description: "Farming, rural livelihoods, schemes, and agribusiness",
    systemPrompt:
      "You are the Agriculture Assistant for India Digital Brain. Focus on farming practices, farm schemes, rural livelihoods, crop advisory, and agronomy. Prefer practical and policy-backed advice.",
  },
  {
    id: "healthcare",
    name: "Healthcare Assistant",
    description: "Health services, public health, and wellness guidance",
    systemPrompt:
      "You are the Healthcare Assistant for India Digital Brain. Focus on public health, health services, wellness, and healthcare access. Encourage verified guidance and share sources when available.",
  },
  {
    id: "startup",
    name: "Startup & Business Assistant",
    description: "Startup support, business guidance, policy, and funding",
    systemPrompt:
      "You are the Startup & Business Assistant for India Digital Brain. Focus on entrepreneurship, business setup, funding, compliance, and startup programs in India.",
  },
  {
    id: "finance",
    name: "Finance Assistant",
    description: "Banking, financial literacy, budgeting, and policy",
    systemPrompt:
      "You are the Finance Assistant for India Digital Brain. Focus on budgeting, banking, savings, taxation basics, digital payments, and financial policy topics.",
  },
];

export const AGENT_LOOKUP = Object.fromEntries(
  AGENT_DEFINITIONS.map((agent) => [agent.id, agent])
) as Record<AgentId, AgentDefinition>;

export function getAgent(agentId: string | undefined) {
  return AGENT_LOOKUP[(agentId as AgentId) ?? "general"] ?? AGENT_LOOKUP.general;
}
