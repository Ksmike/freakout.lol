"use server";

import { existsSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { Agent } from "undici";
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
import type { ModelRoute } from "@/lib/diligence/model-router";
import { buildProjectBlobPrefix } from "@/lib/blob/documents";
import { db } from "@/lib/db";
import {
  AuditAction,
  type ApiKeyProvider,
  DiligenceJobStatus,
} from "@/lib/generated/prisma/client";

const LOCAL_WORKFLOW_HEALTH_PATH = "/.well-known/workflow/v1/flow?__health";
const LOCAL_WORKFLOW_HEALTH_TIMEOUT_MS = 5_000;
const LOCAL_WORKFLOW_FETCH_PATCH_KEY = "__ddQualifyLocalWorkflowFetchPatch";

type FetchWithDispatcherInit = RequestInit & {
  dispatcher?: unknown;
};

type LocalWorkflowFetchPatchState = {
  baseOrigin: string;
  ca: string;
  dispatcher: Agent;
  originalFetch: typeof fetch;
};

type LocalWorkflowFetchPatchGlobal = typeof globalThis & {
  [LOCAL_WORKFLOW_FETCH_PATCH_KEY]?: LocalWorkflowFetchPatchState;
};

function getNestedErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const errorLike = error as { code?: unknown; cause?: unknown };
  if (typeof errorLike.code === "string") {
    return errorLike.code;
  }
  return getNestedErrorCode(errorLike.cause);
}

function describeLocalWorkflowConnectionError(
  error: unknown,
  baseUrl: string
): string {
  const code = getNestedErrorCode(error);
  if (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return `Local Workflow cannot verify the HTTPS certificate at ${baseUrl}. Run mkcert -install, then restart with yarn dev, or switch to yarn dev:http.`;
  }
  if (code === "ERR_SSL_WRONG_VERSION_NUMBER") {
    return `Local Workflow is using HTTPS for an HTTP dev server at ${baseUrl}. Restart with yarn dev:http, or set WORKFLOW_LOCAL_BASE_URL=http://localhost:3000.`;
  }

  const message = error instanceof Error ? error.message : "fetch failed";
  return `Local Workflow cannot reach ${baseUrl}: ${message}. Check WORKFLOW_LOCAL_BASE_URL and restart the dev server.`;
}

function getMkcertRootCa(): string | null {
  const home = homedir();
  const candidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    home ? join(home, "Library/Application Support/mkcert/rootCA.pem") : null,
    home ? join(home, ".local/share/mkcert/rootCA.pem") : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "mkcert", "rootCA.pem")
      : null,
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
  }

  return null;
}

function getRequestUrl(input: Parameters<typeof fetch>[0]): URL | null {
  try {
    if (typeof input === "string" || input instanceof URL) {
      return new URL(input);
    }
    return new URL(input.url);
  } catch {
    return null;
  }
}

function installLocalWorkflowFetchTrust(baseUrl: string): void {
  if (process.env.VERCEL_DEPLOYMENT_ID || process.env.NODE_ENV === "production") {
    return;
  }

  const workflowUrl = new URL(baseUrl);
  if (workflowUrl.protocol !== "https:") {
    return;
  }

  const ca = getMkcertRootCa();
  if (!ca) {
    return;
  }

  const patchGlobal = globalThis as LocalWorkflowFetchPatchGlobal;
  const existingPatch = patchGlobal[LOCAL_WORKFLOW_FETCH_PATCH_KEY];
  if (existingPatch?.baseOrigin === workflowUrl.origin && existingPatch.ca === ca) {
    return;
  }

  const originalFetch = existingPatch?.originalFetch ?? globalThis.fetch.bind(globalThis);
  const dispatcher = new Agent({
    connect: { ca: [...rootCertificates, ca] },
  });

  globalThis.fetch = ((input, init) => {
    const requestUrl = getRequestUrl(input);
    if (
      requestUrl?.origin === workflowUrl.origin &&
      requestUrl.pathname.startsWith("/.well-known/workflow/")
    ) {
      return originalFetch(input, {
        ...init,
        dispatcher,
      } as FetchWithDispatcherInit);
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  patchGlobal[LOCAL_WORKFLOW_FETCH_PATCH_KEY] = {
    baseOrigin: workflowUrl.origin,
    ca,
    dispatcher,
    originalFetch,
  };
}

async function requestLocalWorkflowHealth(
  baseUrl: string
): Promise<{ ok: boolean; status: number }> {
  const url = new URL(`${baseUrl}${LOCAL_WORKFLOW_HEALTH_PATH}`);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  const ca = url.protocol === "https:" ? getMkcertRootCa() : null;

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        timeout: LOCAL_WORKFLOW_HEALTH_TIMEOUT_MS,
        ...(ca ? { ca: [...rootCertificates, ca] } : {}),
      },
      (response) => {
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          resolve({ ok: status >= 200 && status < 300, status });
        });
        response.on("error", reject);
        response.resume();
      }
    );

    req.on("timeout", () => {
      req.destroy(
        Object.assign(new Error("Local Workflow health check timed out."), {
          code: "ETIMEDOUT",
        })
      );
    });
    req.on("error", reject);
    req.end();
  });
}

async function getLocalWorkflowReadinessError(): Promise<string | null> {
  if (process.env.VERCEL_DEPLOYMENT_ID || process.env.NODE_ENV === "production") {
    return null;
  }

  const baseUrl = process.env.WORKFLOW_LOCAL_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return null;
  }

  try {
    installLocalWorkflowFetchTrust(baseUrl);
    const response = await requestLocalWorkflowHealth(baseUrl);
    if (response.ok) {
      return null;
    }

    return `Local Workflow health check at ${baseUrl} returned HTTP ${response.status}. Check WORKFLOW_LOCAL_BASE_URL and restart the dev server.`;
  } catch (error) {
    return describeLocalWorkflowConnectionError(error, baseUrl);
  }
}

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

  const [
    { ModelRouter },
    { UserApiKeyModel },
    { DiligenceJobModel },
    { ProjectDocumentModel },
  ] =
    await Promise.all([
      import("@/lib/diligence/model-router"),
      import("@/lib/models/UserApiKeyModel"),
      import("@/lib/models/DiligenceJobModel"),
      import("@/lib/models/ProjectDocumentModel"),
    ]);

  const existingJob = await DiligenceJobModel.findLatestForProject({
    projectId,
    userId: session.user.id,
  });

  if (
    existingJob?.status === DiligenceJobStatus.QUEUED ||
    existingJob?.status === DiligenceJobStatus.RUNNING
  ) {
    revalidatePath(`/project/${projectId}`);
    revalidatePath("/dashboard");
    return { jobId: existingJob.id };
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

  const enabledKeys = await UserApiKeyModel.listEnabledForUser(session.user.id);
  if (enabledKeys.length === 0) {
    await ProjectModel.updateStatusForUser({
      projectId,
      userId: session.user.id,
      status: "draft",
    });
    revalidatePath(`/project/${projectId}`);
    revalidatePath("/dashboard");
    return { error: "No enabled provider API keys are configured." };
  }

  const modelRouter = new ModelRouter();
  let modelRoute: ModelRoute;
  try {
    modelRoute = modelRouter.route({
      selectedProvider: options?.selectedProvider ?? null,
      selectedModel: options?.selectedModel ?? null,
      fallbackProviders: options?.fallbackProviders ?? null,
      keys: enabledKeys,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to route model provider.";
    await ProjectModel.updateStatusForUser({
      projectId,
      userId: session.user.id,
      status: "draft",
    });
    revalidatePath(`/project/${projectId}`);
    revalidatePath("/dashboard");
    return { error: message };
  }

  const priority = options?.priority ?? 0;
  const workflowReadinessError = await getLocalWorkflowReadinessError();
  if (workflowReadinessError) {
    await ProjectModel.updateStatusForUser({
      projectId,
      userId: session.user.id,
      status: "draft",
    });
    revalidatePath(`/project/${projectId}`);
    revalidatePath("/dashboard");
    return { error: workflowReadinessError };
  }

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
  } else if (
    existingJob.status === DiligenceJobStatus.FAILED ||
    existingJob.status === DiligenceJobStatus.WAITING_INPUT
  ) {
    await db.diligenceJob.updateMany({
      where: { id: existingJob.id, userId: session.user.id },
      data: {
        status: DiligenceJobStatus.QUEUED,
        workflowRunId: null,
        errorMessage: null,
        completedAt: null,
        lastHeartbeatAt: null,
      },
    });
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
    const message =
      error instanceof Error ? error.message : "Failed to start due diligence.";
    const now = new Date();
    await Promise.all([
      db.diligenceJob.updateMany({
        where: { id: jobId, userId: session.user.id },
        data: {
          status: DiligenceJobStatus.FAILED,
          errorMessage: message,
          completedAt: now,
          lastHeartbeatAt: now,
        },
      }),
      ProjectModel.updateStatusForUser({
        projectId,
        userId: session.user.id,
        status: "draft",
      }),
    ]);
    revalidatePath(`/project/${projectId}`);
    revalidatePath("/dashboard");

    return {
      error: message,
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

  const prefix = buildProjectBlobPrefix(project.firmId, projectId);
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

  const projectUpdated = await ProjectModel.updateStatusForUser({
    projectId: job.projectId,
    userId: session.user.id,
    status: "inprogress",
  });
  if (!projectUpdated) {
    return { error: "Project not found." };
  }

  try {
    const workflowReadinessError = await getLocalWorkflowReadinessError();
    if (workflowReadinessError) {
      await ProjectModel.updateStatusForUser({
        projectId: job.projectId,
        userId: session.user.id,
        status: "draft",
      });
      revalidatePath(`/project/${job.projectId}`);
      revalidatePath("/dashboard");
      return { error: workflowReadinessError };
    }

    await db.diligenceJob.updateMany({
      where: { id: jobId, userId: session.user.id },
      data: {
        status: DiligenceJobStatus.QUEUED,
        workflowRunId: null,
        errorMessage: null,
        completedAt: null,
        lastHeartbeatAt: null,
      },
    });

    const run = await start(diligenceWorkflow, [
      { jobId, userId: session.user.id, priority: job.priority },
    ]);

    revalidatePath(`/project/${job.projectId}`);
    revalidatePath("/dashboard");

    return { runId: run.runId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retry due diligence.";
    const now = new Date();
    await Promise.all([
      db.diligenceJob.updateMany({
        where: { id: jobId, userId: session.user.id },
        data: {
          status: DiligenceJobStatus.FAILED,
          errorMessage: message,
          completedAt: now,
          lastHeartbeatAt: now,
        },
      }),
      ProjectModel.updateStatusForUser({
        projectId: job.projectId,
        userId: session.user.id,
        status: "draft",
      }),
    ]);
    revalidatePath(`/project/${job.projectId}`);
    revalidatePath("/dashboard");

    return {
      error: message,
    };
  }
}
