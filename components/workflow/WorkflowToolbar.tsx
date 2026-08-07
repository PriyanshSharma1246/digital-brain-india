"use client";

import { ArrowLeft, Play, Plus, Save } from "lucide-react";
import Link from "next/link";

type Props = {
  name: string;
  workflows: { id: string; name: string }[];
  currentId: string | null;
  saving: boolean;
  running: boolean;
  onNameChange: (v: string) => void;
  onNew: () => void;
  onLoad: (id: string) => void;
  onSave: () => void;
  onRun: () => void;
};

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500";

/**
 * Top toolbar for the workflow builder: workflow name, load/new/save/run
 * actions and a quick-run capability that depends on a saved workflow.
 */
export default function WorkflowToolbar({
  name,
  workflows,
  currentId,
  saving,
  running,
  onNameChange,
  onNew,
  onLoad,
  onSave,
  onRun,
}: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/70 px-4">
      <Link
        href="/dashboard"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800"
        title="Back to dashboard"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Workflow
        </span>
        <input
          className={`${inputClass} w-64`}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Untitled workflow"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Load:</span>
          <select
            className={`${inputClass} max-w-[180px]`}
            value={currentId ?? ""}
            onChange={(e) => e.target.value && onLoad(e.target.value)}
          >
            <option value="">Select a workflow…</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          <Plus size={16} />
          New
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {running ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Play size={16} />}
          {running ? "Running…" : "Run"}
        </button>
      </div>
    </header>
  );
}
