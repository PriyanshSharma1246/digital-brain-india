"use client";

import { AGENT_DEFINITIONS, type AgentId } from "@/lib/agents";

type AgentSelectorProps = {
  value: AgentId;
  onChange: (value: AgentId) => void;
};

export default function AgentSelector({ value, onChange }: AgentSelectorProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Agent</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as AgentId)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      >
        {AGENT_DEFINITIONS.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
}
