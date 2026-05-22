"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del, list } from "@vercel/blob";
import { getRun, start } from "workflow/api";
import { auth } from "@/lib/auth";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { FirmModel } from "@/lib/models/FirmModel";
import { BillingModel } from "@/lib/models/BillingModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { diligenceWorkflow } from "@/lib/diligence/diligence-workflow";
import { buildProjectBlobPrefix } from "@/lib/blob/documents";
import { db } from "@/lib/db";
import {
  AuditAction,
  type ApiKeyProvider,
  DiligenceJobStatus,
} from "@/lib/generated/prisma/client";

export async function createProject(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/projects/new");
  }

  const nameEntry = formData.get("name");
  const name =
    typeof nameEntry === "string" ? nameEntry.trim().slice(0, 120) : "";

  if (!name) {
    redirect("/projects/new");
  }

  // Entitlement check: project count limit
  const firm = await FirmModel.ensureDefaultForUser(session.user.id);
  const entitlementCheck = await BillingModel.checkProjectCreation(firm.firmId);
  if (!entitlementCheck.allowed) {
    // Redirect back with an error query param — the page can surface it
    redirect(`/projects/new?error=${encodeURIComponent(entitlementCheck.reason)}`);
  }

  const project = await ProjectModel.createForUser({
    name,
    userId: session.user.id,
  });

  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.PROJECT_CREATED,
    targetType: "Project",
    targetId: project.id,
    metadata: { name },
  });

  // Set assistance goal if a graph was selected
  const graphIdEntry = formData.get("graphId");
  const graphId = typeof graphIdEntry === "string" ? graphIdEntry.trim() : "";
  if (graphId) {
    const isEnabled = await (await import("@/lib/models/GraphModel")).GraphModel.isEnabledForFirm(firm.firmId, graphId);
    if (isEnabled) {
      await (await import("@/lib/models/GraphModel")).GraphModel.setGoalForProject({
        projectId: project.id,
        graphId,
      });
    }
  }

  redirect(`/project/${project.id}`);
}

export async function startProjectDueDiligence(
  projectId: string,
  options?: {
    selectedProvider?: ApiKeyProvider;
    selectedModel?: string;
    fallbackProviders?: ApiKeyProvider[];
    priority?: number;
  }
): Promise<{ error?: string; jobId?: string; runId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const updated = await ProjectModel.updateStatusForUser({
    projectId,
    userId: session.user.id,
    status: "inprogress",
  });

  if (!updated) {
    return { error: "Project not found." };
  }

  // Entitlement check: monthly run limit
  const firm = await FirmModel.ensureDefaultForUser(session.user.id);
  const runCheck = await BillingModel.checkWorkflowRun(firm.firmId);
  if (!runCheck.allowed) {
    // Revert status
    await ProjectModel.updateStatusForUser({
      projectId,
      userId: session.user.id,
      status: "draft",
    });
    return { error: runCheck.reason };
  }

  const [
    { DiligenceJobStatus },
    { ModelRouter },
    { UserApiKeyModel },
    { DiligenceJobModel },
    { ProjectDocumentModel },
  ] =
    await Promise.all([
      import("@/lib/generated/prisma/client"),
      import("@/lib/diligence/model-router"),
      import("@/lib/models/UserApiKeyModel"),
      import("@/lib/models/DiligenceJobModel"),
      import("@/lib/models/ProjectDocumentModel"),
    ]);

  const enabledKeys = await UserApiKeyModel.listEnabledForUser(session.user.id);
  if (enabledKeys.length === 0) {
    return { error: "No enabled provider API keys are configured." };
  }

  const modelRouter = new ModelRouter();
  const modelRoute = modelRouter.route({
    selectedProvider: options?.selectedProvider ?? null,
    selectedModel: options?.selectedModel ?? null,
    fallbackProviders: options?.fallbackProviders ?? null,
    keys: enabledKeys,
  });

  const existingJob = await DiligenceJobModel.findLatestForProject({
    projectId,
    userId: session.user.id,
  });

  const priority = options?.priority ?? 0;

  let jobId = existingJob?.id;
  if (
    !existingJob ||
    existingJob.status === DiligenceJobStatus.COMPLETED ||
    existingJob.status === DiligenceJobStatus.CANCELED
  ) {
    const inputDocumentCount = await ProjectDocumentModel.countForProject({
      projectId,
      userId: session.user.id,
    });

    const createdJob = await DiligenceJobModel.create({
      projectId,
      userId: session.user.id,
      userApiKeyId: modelRoute.userApiKeyId,
      selectedProvider: modelRoute.selectedProvider,
      selectedModel: modelRoute.selectedModel,
      fallbackProviders: modelRoute.fallbackProviders,
      inputDocumentCount,
      priority,
    });
    jobId = createdJob.id;
  }

  if (!jobId) {
    return { error: "Could not initialize due diligence job." };
  }

  await ProjectDocumentModel.markAllQueuedForProject({
    projectId,
    userId: session.user.id,
  });

  let runId: string | undefined;
  try {
    const run = await start(diligenceWorkflow, [
      { jobId, userId: session.user.id, priority },
    ]);
    runId = run.runId;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to start due diligence.",
      jobId,
    };
  }

  // Increment usage meter and write audit log
  await Promise.all([
    BillingModel.incrementRuns(firm.firmId),
    AuditLogModel.record({
      firmId: firm.firmId,
      actorUserId: session.user.id,
      action: AuditAction.WORKFLOW_STARTED,
      targetType: "DiligenceJob",
      targetId: jobId,
      metadata: { projectId, runId },
    }),
  ]);

  revalidatePath(`/project/${projectId}`);
  revalidatePath("/dashboard");
  return { jobId, runId };
}

export async function cancelProjectDueDiligence(
  jobId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const job = await db.diligenceJob.findFirst({
    where: { id: jobId, userId: session.user.id },
    select: { id: true, projectId: true, workflowRunId: true, status: true },
  });
  if (!job) {
    return { error: "Diligence job not found." };
  }

  if (job.workflowRunId) {
    try {
      await getRun(job.workflowRunId).cancel();
    } catch {
      // Best-effort: run may already be terminal; carry on with status update.
    }
  }

  await db.diligenceJob.updateMany({
    where: { id: jobId, userId: session.user.id },
    data: {
      status: DiligenceJobStatus.CANCELED,
      completedAt: new Date(),
    },
  });

  await ProjectModel.updateStatusForUser({
    projectId: job.projectId,
    userId: session.user.id,
    status: "draft",
  });

  const cancelFirm = await FirmModel.ensureDefaultForUser(session.user.id);
  await AuditLogModel.record({
    firmId: cancelFirm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.WORKFLOW_CANCELED,
    targetType: "DiligenceJob",
    targetId: jobId,
    metadata: { projectId: job.projectId },
  });

  revalidatePath(`/project/${job.projectId}`);
  revalidatePath("/dashboard");

  return {};
}

export async function deleteProject(
  projectId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const project = await ProjectModel.findByIdForUser({
    projectId,
    userId: session.user.id,
  });
  if (!project) {
    return { error: "Project not found." };
  }

  const activeRuns = await db.diligenceJob.findMany({
    where: {
      projectId,
      userId: session.user.id,
      workflowRunId: { not: null },
      status: {
        in: [
          DiligenceJobStatus.QUEUED,
          DiligenceJobStatus.RUNNING,
          DiligenceJobStatus.WAITING_INPUT,
        ],
      },
    },
    select: { workflowRunId: true },
  });

  for (const run of activeRuns) {
    if (!run.workflowRunId) continue;
    try {
      await getRun(run.workflowRunId).cancel();
    } catch {
      // Best-effort cancellation; deletion proceeds either way.
    }
  }

  const prefix = buildProjectBlobPrefix(session.user.id, projectId);
  if (prefix) {
    try {
      const { blobs } = await list({ prefix });
      if (blobs.length > 0) {
        await del(blobs.map((blob) => blob.url));
      }
    } catch {
      // Blob storage may be unconfigured (local-only) or transiently unavailable;
      // DB deletion still proceeds so the user isn't blocked.
    }
  }

  const deleted = await ProjectModel.deleteForUser({
    projectId,
    userId: session.user.id,
  });
  if (!deleted) {
    return { error: "Project not found." };
  }

  const deleteFirm = await FirmModel.ensureDefaultForUser(session.user.id);
  await AuditLogModel.record({
    firmId: deleteFirm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.PROJECT_DELETED,
    targetType: "Project",
    targetId: projectId,
    metadata: { name: project.name },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/project/${projectId}`);
  return {};
}

export async function retryProjectDueDiligence(
  jobId: string
): Promise<{ error?: string; runId?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const { DiligenceJobModel } = await import("@/lib/models/DiligenceJobModel");

  const job = await DiligenceJobModel.findByIdForUser({
    jobId,
    userId: session.user.id,
  });
  if (!job) {
    return { error: "Diligence job not found." };
  }

  try {
    const run = await start(diligenceWorkflow, [
      { jobId, userId: session.user.id, priority: job.priority },
    ]);

    revalidatePath(`/project/${job.projectId}`);
    revalidatePath("/dashboard");

    return { runId: run.runId };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to retry due diligence.",
    };
  }
}
