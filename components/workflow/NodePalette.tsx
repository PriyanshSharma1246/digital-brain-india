"use client";

import { Database, Flag, GripVertical, Play, Sparkles, Wrench } from "lucide-react";
import { NODE_META, type BuilderNodeType } from "./types";

const ORDER: BuilderNodeType[] = ["trigger", "agent", "rag", "tool", "output"];

const ICONS: Record<BuilderNodeType, typeof Play> = {
  trigger: Play,
  agent: Sparkles,
  rag: Database,
  tool: Wrench,
  output: Flag,
};

/**
 * Left-hand palette of draggable node types. Dragging an item onto the canvas
 * drops a new node of that type (see WorkflowCanvas onDrop).
 */
export default function NodePalette() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <GripVertical size={16} className="text-slate-500" />
        Node Palette
      </div>

      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Drag a node onto the canvas to add it to your workflow. Connect nodes by
        dragging from a node&apos;s right handle to the next node&apos;s left handle.
      </p>

      <div className="flex flex-col gap-2">
        {ORDER.map((type) => {
          const meta = NODE_META[type];
          const Icon = ICONS[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/workflow-node", type);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="group flex cursor-grab items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3 transition hover:border-slate-600 hover:bg-slate-800/80 active:cursor-grabbing"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
              >
                <Icon size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">{meta.label}</p>
                <p className="truncate text-[11px] text-slate-400">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
