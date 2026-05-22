"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Panel,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  LuLayoutDashboard,
  LuPlus,
  LuTrash2,
  LuX,
  LuCircleCheck,
  LuTriangleAlert,
} from "react-icons/lu";
import { applyDagreLayout } from "@/lib/graph/layout";
import {
  addGraphNode,
  addGraphEdge,
  deleteGraphNode,
  deleteGraphEdge,
  updateGraphNode,
  addGraphRequirement,
  deleteGraphRequirement,
} from "@/lib/actions/graph";

// ─── Node kinds ───────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  QUESTION: "border-primary bg-primary/5",
  CONTROL: "border-secondary bg-secondary/5",
  EVIDENCE_TYPE: "border-success bg-success/5",
  RISK_CATEGORY: "border-danger bg-danger/5",
  OUTPUT_SECTION: "border-warning bg-warning/5",
  ENTITY: "border-default bg-content2",
};

const KIND_BADGE: Record<string, string> = {
  QUESTION: "bg-primary/15 text-primary",
  CONTROL: "bg-secondary/15 text-secondary",
  EVIDENCE_TYPE: "bg-success/15 text-success",
  RISK_CATEGORY: "bg-danger/15 text-danger",
  OUTPUT_SECTION: "bg-warning/15 text-warning",
  ENTITY: "bg-content2 text-foreground/60",
};

// ─── Custom node component ────────────────────────────────────────────────────

type OntologyNodeData = {
  label: string;
  kind: string;
  description?: string | null;
  requirementCount: number;
  onSelect: (id: string) => void;
};

function OntologyNodeCard({ id, data, selected }: { id: string; data: OntologyNodeData; selected: boolean }) {
  return (
    <div
      onClick={() => data.onSelect(id)}
      className={`w-[220px] cursor-pointer rounded-xl border-2 bg-content1 p-3 shadow-sm transition-shadow hover:shadow-md ${
        selected ? "border-primary shadow-md" : (KIND_COLORS[data.kind] ?? KIND_COLORS.ENTITY)
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug">{data.label}</p>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${KIND_BADGE[data.kind] ?? KIND_BADGE.ENTITY}`}>
          {data.kind.replace(/_/g, " ")}
        </span>
      </div>
      {data.description && (
        <p className="mt-1 line-clamp-2 text-xs text-foreground/55">{data.description}</p>
      )}
      <p className="mt-2 text-xs text-foreground/40">{data.requirementCount} requirements</p>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  ontologyNode: OntologyNodeCard as unknown as NodeTypes[string],
};

// ─── Edge kinds ───────────────────────────────────────────────────────────────

const EDGE_KINDS = ["REQUIRES", "SATISFIES", "CONTRADICTS", "MAPS_TO", "ESCALATES_TO", "PART_OF"];
const NODE_KINDS = ["QUESTION", "CONTROL", "EVIDENCE_TYPE", "RISK_CATEGORY", "OUTPUT_SECTION", "ENTITY"];

// ─── Types ────────────────────────────────────────────────────────────────────

type GraphNode = {
  id: string;
  slug: string;
  label: string;
  kind: string;
  description: string | null;
};

type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: string;
};

type Requirement = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  nodeId: string;
};

type Props = {
  graphId: string;
  graphStatus: string;
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
  initialRequirements: Requirement[];
};

// ─── Main canvas ──────────────────────────────────────────────────────────────

export function GraphCanvas({
  graphId,
  graphStatus,
  initialNodes,
  initialEdges,
  initialRequirements,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);

  // Requirements state (local, synced on mutations)
  const [requirements, setRequirements] = useState<Requirement[]>(initialRequirements);

  // ── Build RF nodes/edges from DB data ──────────────────────────────────────

  function buildRFNodes(nodes: GraphNode[]): Node[] {
    return nodes.map((n) => ({
      id: n.id,
      type: "ontologyNode",
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        kind: n.kind,
        description: n.description,
        requirementCount: requirements.filter((r) => r.nodeId === n.id).length,
        onSelect: setSelectedNodeId,
      },
    }));
  }

  function buildRFEdges(edges: GraphEdge[]): Edge[] {
    return edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      label: e.kind.replace(/_/g, " "),
      type: "smoothstep",
      animated: e.kind === "REQUIRES",
      style: { stroke: "hsl(var(--heroui-primary))", strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: "hsl(var(--heroui-foreground-500))" },
      labelBgStyle: { fill: "hsl(var(--heroui-content1))", fillOpacity: 0.9 },
    }));
  }

  const rfNodesInit = buildRFNodes(initialNodes);
  const rfEdgesInit = buildRFEdges(initialEdges);
  const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(rfNodesInit, rfEdgesInit);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Keep requirement counts in sync
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          requirementCount: requirements.filter((r) => r.nodeId === n.id).length,
          onSelect: setSelectedNodeId,
        },
      }))
    );
  }, [requirements, setNodes]);

  // ── Auto-layout ────────────────────────────────────────────────────────────

  function handleAutoLayout() {
    const { nodes: ln, edges: le } = applyDagreLayout(nodes, edges);
    setNodes(ln);
    setEdges(le);
  }

  // ── Connect edge on drop ───────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: "smoothstep" }, eds));
    },
    [setEdges]
  );

  // ── Toast helper ───────────────────────────────────────────────────────────

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Selected node data ─────────────────────────────────────────────────────

  const selectedNode = selectedNodeId
    ? initialNodes.find((n) => n.id === selectedNodeId) ?? null
    : null;
  const selectedNodeReqs = requirements.filter((r) => r.nodeId === selectedNodeId);

  // ── Add node ───────────────────────────────────────────────────────────────

  function AddNodePanel() {
    const [label, setLabel] = useState("");
    const [slug, setSlug] = useState("");
    const [kind, setKind] = useState("QUESTION");
    const [desc, setDesc] = useState("");

    return (
      <div className="absolute right-4 top-4 z-10 w-72 rounded-xl border border-divider bg-content1 p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Add node</p>
          <button type="button" onClick={() => setShowAddNode(false)} className="text-foreground/40 hover:text-foreground">
            <LuX className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="Label"
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {NODE_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
          </select>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-none rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            disabled={!label || !slug || isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await addGraphNode({ graphId, slug, label, kind, description: desc || undefined });
                if (result.error) { showToast("error", result.error); return; }
                // Add to canvas
                const newNode: Node = {
                  id: result.id!,
                  type: "ontologyNode",
                  position: { x: Math.random() * 400, y: Math.random() * 300 },
                  data: { label, kind, description: desc || null, requirementCount: 0, onSelect: setSelectedNodeId },
                };
                setNodes((nds) => [...nds, newNode]);
                showToast("success", "Node added");
                setShowAddNode(false);
              });
            }}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add node
          </button>
        </div>
      </div>
    );
  }

  // ── Add edge ───────────────────────────────────────────────────────────────

  function AddEdgePanel() {
    const [sourceId, setSourceId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [kind, setKind] = useState("REQUIRES");

    return (
      <div className="absolute right-4 top-4 z-10 w-72 rounded-xl border border-divider bg-content1 p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Add edge</p>
          <button type="button" onClick={() => setShowAddEdge(false)} className="text-foreground/40 hover:text-foreground">
            <LuX className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Source node…</option>
            {initialNodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {EDGE_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Target node…</option>
            {initialNodes.filter((n) => n.id !== sourceId).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <button
            type="button"
            disabled={!sourceId || !targetId || isPending}
            onClick={() => {
              startTransition(async () => {
                const result = await addGraphEdge({ graphId, sourceId, targetId, kind });
                if (result.error) { showToast("error", result.error); return; }
                const newEdge: Edge = {
                  id: result.id!,
                  source: sourceId,
                  target: targetId,
                  label: kind.replace(/_/g, " "),
                  type: "smoothstep",
                  animated: kind === "REQUIRES",
                  style: { stroke: "hsl(var(--heroui-primary))", strokeWidth: 1.5 },
                  labelStyle: { fontSize: 10 },
                };
                setEdges((eds) => [...eds, newEdge]);
                showToast("success", "Edge added");
                setShowAddEdge(false);
              });
            }}
            className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add edge
          </button>
        </div>
      </div>
    );
  }

  // ── Node detail panel ──────────────────────────────────────────────────────

  function NodeDetailPanel() {
    if (!selectedNode) return null;
    const [editLabel, setEditLabel] = useState(selectedNode.label);
    const [editDesc, setEditDesc] = useState(selectedNode.description ?? "");
    const [newReqTitle, setNewReqTitle] = useState("");
    const [newReqPriority, setNewReqPriority] = useState("medium");

    return (
      <div className="absolute bottom-4 left-4 z-10 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-divider bg-content1 p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${KIND_BADGE[selectedNode.kind] ?? KIND_BADGE.ENTITY}`}>
              {selectedNode.kind.replace(/_/g, " ")}
            </span>
            <p className="text-sm font-semibold text-foreground">{selectedNode.label}</p>
          </div>
          <button type="button" onClick={() => setSelectedNodeId(null)} className="text-foreground/40 hover:text-foreground">
            <LuX className="size-4" />
          </button>
        </div>

        {/* Edit label/desc */}
        <div className="mb-3 space-y-2">
          <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
            placeholder="Description"
            className="w-full resize-none rounded-md border border-divider bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-2">
            <button type="button" disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await updateGraphNode({ nodeId: selectedNode.id, graphId, label: editLabel, description: editDesc || undefined });
                  setNodes((nds) => nds.map((n) => n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, label: editLabel, description: editDesc || null } }
                    : n));
                  showToast("success", "Node updated");
                });
              }}
              className="flex-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:opacity-80 disabled:opacity-50">
              Save
            </button>
            <button type="button" disabled={isPending}
              onClick={() => {
                if (!confirm("Delete this node and all its requirements?")) return;
                startTransition(async () => {
                  await deleteGraphNode({ nodeId: selectedNode.id, graphId });
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setRequirements((rs) => rs.filter((r) => r.nodeId !== selectedNode.id));
                  setSelectedNodeId(null);
                  showToast("success", "Node deleted");
                });
              }}
              className="rounded-md bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:opacity-80 disabled:opacity-50">
              <LuTrash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Requirements */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
            Requirements ({selectedNodeReqs.length})
          </p>
          <ul className="mb-2 space-y-1">
            {selectedNodeReqs.map((req) => (
              <li key={req.id} className="flex items-start justify-between gap-2 rounded-md bg-content2/50 px-2.5 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-foreground leading-snug">{req.title}</p>
                  <span className={`text-[10px] ${req.priority === "high" ? "text-danger" : req.priority === "low" ? "text-foreground/40" : "text-warning"}`}>
                    {req.priority}
                  </span>
                </div>
                <button type="button" disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteGraphRequirement({ requirementId: req.id, graphId });
                      setRequirements((rs) => rs.filter((r) => r.id !== req.id));
                    });
                  }}
                  className="shrink-0 text-foreground/30 hover:text-danger disabled:opacity-50">
                  <LuX className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          {/* Add requirement */}
          <div className="space-y-1.5">
            <input value={newReqTitle} onChange={(e) => setNewReqTitle(e.target.value)}
              placeholder="New requirement title"
              className="w-full rounded-md border border-divider bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            <div className="flex gap-1.5">
              <select value={newReqPriority} onChange={(e) => setNewReqPriority(e.target.value)}
                className="flex-1 rounded-md border border-divider bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button type="button" disabled={!newReqTitle || isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await addGraphRequirement({
                      graphId,
                      nodeId: selectedNode.id,
                      title: newReqTitle,
                      priority: newReqPriority,
                    });
                    if (result.error) { showToast("error", result.error); return; }
                    setRequirements((rs) => [...rs, {
                      id: result.id!,
                      title: newReqTitle,
                      description: null,
                      priority: newReqPriority,
                      nodeId: selectedNode.id,
                    }]);
                    setNewReqTitle("");
                    showToast("success", "Requirement added");
                  });
                }}
                className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <LuPlus className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        onEdgesDelete={(deleted) => {
          for (const edge of deleted) {
            startTransition(async () => {
              await deleteGraphEdge({ edgeId: edge.id, graphId });
            });
          }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-30" />
        <Controls />
        <MiniMap nodeColor={() => "hsl(var(--heroui-primary))"} className="rounded-lg border border-divider" />

        {/* Toolbar */}
        <Panel position="top-left">
          <div className="flex items-center gap-2 rounded-xl border border-divider bg-content1 p-2 shadow-sm">
            <button
              type="button"
              onClick={handleAutoLayout}
              title="Auto-layout"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-content2"
            >
              <LuLayoutDashboard className="size-3.5" aria-hidden="true" />
              Layout
            </button>
            {graphStatus === "DRAFT" && (
              <>
                <div className="h-4 w-px bg-divider" />
                <button
                  type="button"
                  onClick={() => { setShowAddNode(true); setShowAddEdge(false); }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <LuPlus className="size-3.5" aria-hidden="true" />
                  Node
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddEdge(true); setShowAddNode(false); }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-content2"
                >
                  <LuPlus className="size-3.5" aria-hidden="true" />
                  Edge
                </button>
              </>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {/* Panels */}
      {showAddNode && graphStatus === "DRAFT" && <AddNodePanel />}
      {showAddEdge && graphStatus === "DRAFT" && <AddEdgePanel />}
      {selectedNodeId && <NodeDetailPanel />}

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
          toast.type === "success" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
        }`}>
          {toast.type === "success"
            ? <LuCircleCheck className="size-4" aria-hidden="true" />
            : <LuTriangleAlert className="size-4" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
