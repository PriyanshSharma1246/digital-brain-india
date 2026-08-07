"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Database, Flag, Play, Sparkles, Wrench } from "lucide-react";
import { NODE_META, type BuilderNodeType, type WorkflowNodeData } from "./types";

const NODE_ICONS: Record<BuilderNodeType, typeof Play> = {
  trigger: Play,
  agent: Sparkles,
  rag: Database,
  tool: Wrench,
  output: Flag,
};

/**
 * Custom React Flow node rendered for every builder node type. The visual
 * treatment (border accent, icon, subtitle) follows the builder node type;
 * configuration lives in `data` and is edited via the NodeEditor panel.
 */
function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = (data ?? {}) as WorkflowNodeData;
  const meta = NODE_META[nodeData.nodeType] ?? NODE_META.agent;
  const Icon = NODE_ICONS[nodeData.nodeType] ?? Sparkles;

  return (
    <div
      className={`w-52 rounded-xl border bg-slate-900/90 shadow-lg transition ${
        selected ? "ring-2 opacity-100" : "hover:shadow-xl"
      }`}
      style={{ borderColor: meta.color }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-slate-900 !bg-slate-400" />

      <div className="flex items-center gap-3 p-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{nodeData.label || meta.label}</p>
          <p className="truncate text-[11px] text-slate-400">{meta.description}</p>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-slate-900 !bg-slate-400" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
