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
    action: AuditAction.PROJECT_CREATED, // reuse closest available; GRAPH_ENABLED pending
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
