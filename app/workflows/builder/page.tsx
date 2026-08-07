"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { Node as RFNode } from "reactflow";
import WorkflowCanvas, { type WorkflowCanvasHandle } from "@/components/workflow/WorkflowCanvas";
import NodePalette from "@/components/workflow/NodePalette";
import NodeEditor from "@/components/workflow/NodeEditor";
import WorkflowToolbar from "@/components/workflow/WorkflowToolbar";
import {
  fromBackendNode,
  fromBackendEdge,
  toBackendNodes,
  toBackendEdges,
  type WorkflowNodeData,
} from "@/components/workflow/types";

type WorkflowSummary = { id: string; name: string };
type BackendWorkflow = {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
};

function WorkflowBuilderInner() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<WorkflowCanvasHandle>(null);

  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [editorNode, setEditorNode] = useState<RFNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const notify = useCallback((message: string | null) => {
    setNotice(message);
    if (message) window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const loadWorkflowList = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      const json = await res.json();
      const items: BackendWorkflow[] = Array.isArray(json.items) ? json.items : [];
      setWorkflows(items.map((w) => ({ id: w.id, name: w.name })));
    } catch {
      notify("Could not load workflow list");
    }
  }, [notify]);

  const loadFlow = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/workflows/${id}`);
        const json = await res.json();
        if (!json.success || !json.workflow) {
          notify(json.error ?? "Failed to load workflow");
          return;
        }
        const wf: BackendWorkflow = json.workflow;
        const nodes = (wf.nodes ?? []).map((n) => fromBackendNode(n as Parameters<typeof fromBackendNode>[0]));
        const edges = (wf.edges ?? []).map((e) => fromBackendEdge(e as Parameters<typeof fromBackendEdge>[0]));
        canvasRef.current?.load({ nodes, edges });
        setWorkflowId(wf.id);
        setName(wf.name);
        setEditorNode(null);
        setRunResult(null);
        notify("Workflow loaded");
      } catch {
        notify("Failed to load workflow");
      }
    },
    [notify]
  );

  useEffect(() => {
    let cancelled = false;
    const id = searchParams.get("id");
    void (async () => {
      await loadWorkflowList();
      if (cancelled || !id) return;
      await loadFlow(id);
    })();
    return () => {
      cancelled = true;
    };
    // URL is read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectNode = useCallback((node: RFNode | null) => {
    setEditorNode(node);
  }, []);

  const handleNodeDataChange = useCallback((id: string, data: WorkflowNodeData) => {
    canvasRef.current?.updateNodeData(id, data);
    setEditorNode((prev) => (prev && prev.id === id ? { ...prev, data } : prev));
  }, []);

  const newFlow = useCallback(() => {
    if (workflowId && !window.confirm("Discard the current workflow and start a new one?")) return;
    canvasRef.current?.clear();
    setWorkflowId(null);
    setName("");
    setEditorNode(null);
    setRunResult(null);
    notify("New empty workflow");
  }, [workflowId, notify]);

  const saveFlow = useCallback(async (): Promise<string | null> => {
    if (!name.trim()) {
      notify("Please name the workflow before saving");
      return null;
    }
    const flow = canvasRef.current?.getFlow() ?? { nodes: [], edges: [] };
    const payload = {
      name,
      description: "",
      nodes: toBackendNodes(flow.nodes),
      edges: toBackendEdges(flow.edges),
    };
    setSaving(true);
    try {
      const res = await fetch(workflowId ? `/api/workflows/${workflowId}` : "/api/workflows", {
        method: workflowId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        notify(json.error ?? "Save failed");
        return null;
      }
      const id: string = json.workflow?.id ?? workflowId ?? "";
      setWorkflowId(id);
      notify("Workflow saved");
      loadWorkflowList();
      return id;
    } catch {
      notify("Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [name, workflowId, notify, loadWorkflowList]);

  const runFlow = useCallback(async () => {
    let id = workflowId;
    if (!id) {
      id = await saveFlow();
      if (!id) return;
    }
    setRunning(true);
    try {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: {} }),
      });
      const json = await res.json();
      setRunResult(
        json.success
          ? JSON.stringify(json.result?.output ?? json.result, null, 2)
          : JSON.stringify(json, null, 2)
      );
      notify(json.success ? "Workflow run completed" : "Workflow run failed");
    } catch {
      setRunResult("Run failed — check console");
      notify("Workflow run failed");
    } finally {
      setRunning(false);
    }
  }, [workflowId, saveFlow, notify]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <WorkflowToolbar
        name={name}
        workflows={workflows}
        currentId={workflowId}
        saving={saving}
        running={running}
        onNameChange={setName}
        onNew={newFlow}
        onLoad={(id) => loadFlow(id)}
        onSave={() => saveFlow()}
        onRun={runFlow}
      />

      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <div className="min-w-0 flex-1">
          <WorkflowCanvas
            ref={canvasRef}
            onSelectNode={handleSelectNode}
          />
        </div>
        <NodeEditor node={editorNode} onUpdate={handleNodeDataChange} />
      </div>

      {notice && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {notice}
        </div>
      )}

      {runResult && (
        <div className="flex h-48 shrink-0 flex-col border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm font-semibold text-slate-200">Run Result</span>
            <button
              type="button"
              onClick={() => setRunResult(null)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto px-4 pb-3 text-xs leading-relaxed text-slate-300">
            {runResult}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-950" />}>
      <WorkflowBuilderInner />
    </Suspense>
  );
}

