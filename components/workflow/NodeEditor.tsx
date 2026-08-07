"use client";

import { SlidersHorizontal } from "lucide-react";
import type { Node } from "reactflow";
import { NODE_META, type WorkflowNodeData } from "./types";

const CONNECTORS = [
  { value: "weather", label: "Weather (IMD)" },
  { value: "data-gov", label: "Data.gov.in" },
  { value: "agriculture", label: "Agriculture" },
  { value: "employment", label: "Employment" },
  { value: "government-schemes", label: "Government Schemes" },
];

type Props = {
  node: Node | null;
  onUpdate: (id: string, data: WorkflowNodeData) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500";

/**
 * Right-hand inspector that edits the configuration of the currently selected
 * node. Field set adapts to the node type and writes straight back to the
 * canvas via `onUpdate`.
 */
export default function NodeEditor({ node, onUpdate }: Props) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <SlidersHorizontal size={16} className="text-slate-500" />
          Node Editor
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-slate-500">
          <SlidersHorizontal size={28} className="mb-2 text-slate-700" />
          Select a node on the canvas to edit its settings.
        </div>
      </aside>
    );
  }

  const data = (node.data ?? {}) as WorkflowNodeData;
  const meta = NODE_META[data.nodeType] ?? NODE_META.agent;

  const set = (patch: Partial<WorkflowNodeData>) => {
    onUpdate(node.id, { ...data, ...patch });
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        {meta.label} — Configure
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Label">
          <input
            className={inputClass}
            value={data.label ?? ""}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="Node label"
          />
        </Field>

        {(data.nodeType === "trigger" || data.nodeType === "agent") && (
          <>
            <Field label="Prompt / Instruction">
              <textarea
                className={`${inputClass} resize-y`}
                rows={5}
                value={data.prompt ?? ""}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="Enter the prompt sent to the model"
              />
            </Field>
            {data.nodeType === "agent" && (
              <Field label="Temperature">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={data.temperature ?? 0.7}
                  onChange={(e) =>
                    set({ temperature: Number(e.target.value) || undefined })
                  }
                />
              </Field>
            )}
          </>
        )}

        {data.nodeType === "rag" && (
          <>
            <Field label="Search Query">
              <textarea
                className={`${inputClass} resize-y`}
                rows={4}
                value={data.query ?? ""}
                onChange={(e) => set({ query: e.target.value })}
                placeholder="What knowledge to retrieve"
              />
            </Field>
            <Field label="Top K">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={20}
                value={data.topK ?? 5}
                onChange={(e) => set({ topK: Number(e.target.value) || undefined })}
              />
            </Field>
          </>
        )}

        {data.nodeType === "tool" && (
          <>
            <Field label="Connector">
              <select
                className={inputClass}
                value={data.connector ?? ""}
                onChange={(e) => set({ connector: e.target.value })}
              >
                {CONNECTORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Query (optional)">
              <input
                className={inputClass}
                value={data.query ?? ""}
                onChange={(e) => set({ query: e.target.value })}
                placeholder="Search term for the connector"
              />
            </Field>
          </>
        )}

        {data.nodeType === "output" && (
          <>
            <Field label="Template (optional)">
              <textarea
                className={`${inputClass} resize-y`}
                rows={3}
                value={data.template ?? ""}
                onChange={(e) => set({ template: e.target.value })}
                placeholder="Template for the final response, e.g. ${result}"
              />
            </Field>
            <Field label="Result Key">
              <input
                className={inputClass}
                value={data.resultKey ?? "output"}
                onChange={(e) => set({ resultKey: e.target.value || "output" })}
              />
            </Field>
          </>
        )}
      </div>
    </aside>
  );
}
