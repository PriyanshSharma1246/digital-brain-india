"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from "reactflow";
import "reactflow/dist/style.css";
import { WorkflowNode } from "./WorkflowNode";
import { defaultNodeData, NODE_META, type BuilderNodeType, type WorkflowNodeData } from "./types";

const nodeTypes = {
  trigger: WorkflowNode,
  agent: WorkflowNode,
  rag: WorkflowNode,
  tool: WorkflowNode,
  output: WorkflowNode,
};

export type FlowData = { nodes: Node[]; edges: Edge[] };

export type WorkflowCanvasHandle = {
  load: (flow: FlowData) => void;
  getFlow: () => FlowData;
  clear: () => void;
  updateNodeData: (id: string, data: WorkflowNodeData) => void;
};

type Props = {
  onSelectNode: (node: Node | null) => void;
};

function CanvasInner({ onSelectNode }: Props, ref: React.Ref<WorkflowCanvasHandle>) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { screenToFlowPosition } = useReactFlow();
  const selectedIdRef = useRef<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      load: (flow: FlowData) => {
        setNodes(flow.nodes);
        setEdges(flow.edges);
        selectedIdRef.current = null;
        onSelectNode(null);
      },
      getFlow: () => ({ nodes, edges }),
      clear: () => {
        setNodes([]);
        setEdges([]);
        selectedIdRef.current = null;
        onSelectNode(null);
      },
      updateNodeData: (id: string, data: WorkflowNodeData) => {
        setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
      },
    }),
    [nodes, edges, onSelectNode]
  );

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    // When a node is deleted, prune its edges so the graph stays consistent.
    const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
    if (removed.length > 0) {
      setEdges((eds) =>
        eds.filter((e) => !removed.includes(e.source) && !removed.includes(e.target))
      );
    }
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const handleConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge({ ...params, id: `edge-${Date.now()}`, type: "smoothstep" }, eds)
    );
  }, []);

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const selectedNode = selected.length > 0 ? selected[0] : null;
      selectedIdRef.current = selectedNode?.id ?? null;
      onSelectNode(selectedNode ?? null);
    },
    [onSelectNode]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/workflow-node") as BuilderNodeType;
      if (!type || !NODE_META[type]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: defaultNodeData(type),
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!border-slate-700 !bg-slate-900/90 [&_button]:!border-slate-700 [&_button]:!bg-slate-900 [&_button]:!text-slate-300" />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(2, 6, 23, 0.6)"
          nodeColor={() => "#475569"}
          className="!bg-slate-900/90 !border !border-slate-700"
        />
      </ReactFlow>
    </div>
  );
}

const CanvasInnerForwarded = forwardRef<WorkflowCanvasHandle, Props>(CanvasInner);

export default function WorkflowCanvas(props: Props & { ref?: React.Ref<WorkflowCanvasHandle> }) {
  return (
    <ReactFlowProvider>
      <CanvasInnerForwarded {...props} />
    </ReactFlowProvider>
  );
}
