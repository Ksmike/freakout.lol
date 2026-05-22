"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { FirmModel } from "@/lib/models/FirmModel";
import { GraphModel, type GraphSummary, type GapSummary, type MappingSummary } from "@/lib/models/GraphModel";
import { hasFirmPermission } from "@/lib/authz/permissions";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { AuditAction, EvidenceRequirementStatus } from "@/lib/generated/prisma/client";

// ── Firm graph enablement ─────────────────────────────────────────────────────

export async function listAvailableGraphs(): Promise<GraphSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  return GraphModel.listPublishedWithEnablementStatus(firm.firmId);
}

export async function listEnabledGraphs(): Promise<GraphSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  return GraphModel.listEnabledForFirm(firm.firmId);
}

export async function enableGraph(
  graphId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "graphs.enable")) {
    return { error: "You do not have permission to enable graph workflows." };
  }

  await GraphModel.enableForFirm({
    firmId: firm.firmId,
    graphId,
    enabledBy: session.user.id,
  });

  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.GRAPH_ENABLED,
    targetType: "KnowledgeGraphDefinition",
    targetId: graphId,
  });

  revalidatePath("/settings");
  return {};
}

export async function disableGraph(
  graphId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "graphs.enable")) {
    return { error: "You do not have permission to manage graph workflows." };
  }

  await GraphModel.disableForFirm({ firmId: firm.firmId, graphId });

  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.GRAPH_DISABLED,
    targetType: "KnowledgeGraphDefinition",
    targetId: graphId,
  });

  revalidatePath("/settings");
  return {};
}

// ── Assistance goal (per project) ─────────────────────────────────────────────

export async function setProjectAssistanceGoal(
  projectId: string,
  graphId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

  // Verify the graph is enabled for this firm
  const isEnabled = await GraphModel.isEnabledForFirm(firm.firmId, graphId);
  if (!isEnabled) {
    return { error: "This workflow is not enabled for your firm." };
  }

  await GraphModel.setGoalForProject({ projectId, graphId });

  revalidatePath(`/project/${projectId}`);
  return {};
}

export async function getProjectGoalWithRequirements(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return GraphModel.getGoalForProject(projectId);
}

// ── Evidence mappings ─────────────────────────────────────────────────────────

export async function getProjectGaps(projectId: string): Promise<GapSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return GraphModel.getGapsForProject(projectId);
}

export async function getProjectMappings(
  projectId: string
): Promise<MappingSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return GraphModel.getMappingsForProject(projectId);
}

export async function updateEvidenceMapping(input: {
  projectId: string;
  requirementId: string;
  status: EvidenceRequirementStatus;
  analystNote?: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "evidence.review")) {
    return { error: "You do not have permission to update evidence mappings." };
  }

  await GraphModel.upsertMapping({
    projectId: input.projectId,
    requirementId: input.requirementId,
    userId: session.user.id,
    firmId: firm.firmId,
    status: input.status,
    analystNote: input.analystNote,
  });

  revalidatePath(`/project/${input.projectId}`);
  return {};
}

// ── Platform admin: graph management ─────────────────────────────────────────

export async function listAllGraphs(): Promise<GraphSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // For now, any authenticated user can view the admin graph list.
  // A platform-admin role check would go here once that role exists.
  return GraphModel.listAll();
}

export async function publishGraph(
  graphId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.publishGraph(graphId);
  revalidatePath("/admin/graphs");
  return {};
}

export async function deprecateGraph(
  graphId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.deprecateGraph(graphId);
  revalidatePath("/admin/graphs");
  return {};
}

// ── Graph Studio: create / edit graph definitions ────────────────────────────

export async function createGraph(formData: FormData): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const name = (formData.get("name") as string | null)?.trim();
  const slug = (formData.get("slug") as string | null)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const description = (formData.get("description") as string | null)?.trim() || undefined;

  if (!name || !slug) return { error: "Name and slug are required." };

  try {
    const graph = await GraphModel.createGraph({ slug, name, description });
    revalidatePath("/admin/graphs");
    return { id: graph.id };
  } catch {
    return { error: "A graph with that slug already exists." };
  }
}

export async function updateGraphMeta(input: {
  graphId: string;
  name: string;
  description?: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.updateGraphMeta(input);
  revalidatePath("/admin/graphs");
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return {};
}

export async function addGraphNode(input: {
  graphId: string;
  slug: string;
  label: string;
  description?: string;
  kind: string;
}): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  try {
    const node = await GraphModel.addNode(input);
    revalidatePath(`/admin/graphs/${input.graphId}`);
    return { id: node.id };
  } catch {
    return { error: "A node with that slug already exists in this graph." };
  }
}

export async function updateGraphNode(input: {
  nodeId: string;
  graphId: string;
  label: string;
  description?: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.updateNode(input);
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return {};
}

export async function deleteGraphNode(input: {
  nodeId: string;
  graphId: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.deleteNode(input.nodeId);
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return {};
}

export async function addGraphEdge(input: {
  graphId: string;
  sourceId: string;
  targetId: string;
  kind: string;
}): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  try {
    const edge = await GraphModel.addEdge(input);
    revalidatePath(`/admin/graphs/${input.graphId}`);
    return { id: edge.id };
  } catch {
    return { error: "That edge already exists." };
  }
}

export async function deleteGraphEdge(input: {
  edgeId: string;
  graphId: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.deleteEdge(input.edgeId);
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return {};
}

export async function addGraphRequirement(input: {
  graphId: string;
  nodeId: string;
  title: string;
  description?: string;
  priority?: string;
}): Promise<{ error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const req = await GraphModel.addRequirement(input);
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return { id: req.id };
}

export async function deleteGraphRequirement(input: {
  requirementId: string;
  graphId: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  await GraphModel.deleteRequirement(input.requirementId);
  revalidatePath(`/admin/graphs/${input.graphId}`);
  return {};
}

export async function getGraphDetail(graphId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  return GraphModel.findById(graphId);
}
