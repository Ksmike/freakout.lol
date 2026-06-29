import { FatalError, getWorkflowMetadata } from "workflow";
import {
  DiligenceJobStatus,
  type DiligenceStageName,
  DiligenceStageStatus,
} from "@/lib/generated/prisma/client";
import { DiligenceFatalError } from "@/lib/diligence/errors";

export type DiligenceWorkflowInput = {
  jobId: string;
  userId: string;
  priority: number;
};

// Schema-enum drift (e.g., a renamed DiligenceStageName) bubbles up as a
// Prisma error string and must halt the workflow — there is no recovery
// without a code change. Other transient errors fall through to the
// workflow's retry machinery.
const FATAL_MESSAGE_PATTERNS = [
  "invalid input value for enum \"DiligenceStageName\"",
];

async function runStage(input: {
  jobId: string;
  userId: string;
}): Promise<{ status: "completed" | "progressed" | "waiting_input"; stage?: DiligenceStageName }> {
  "use step";

  const { DiligenceWorker } = await import("@/lib/diligence/diligence-worker");
  const worker = new DiligenceWorker();

  try {
    return await worker.runNextStage(input);
  } catch (error) {
    if (error instanceof DiligenceFatalError) {
      throw new FatalError(error.message);
    }
    const message =
      error instanceof Error ? error.message : "Stage execution failed.";
    if (FATAL_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))) {
      throw new FatalError(message);
    }
    throw error;
  }
}

async function attachRunIdToJob(input: {
  jobId: string;
  userId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const { db } = await import("@/lib/db");
  await db.diligenceJob.updateMany({
    where: { id: input.jobId, userId: input.userId },
    data: { workflowRunId: input.workflowRunId },
  });
}

async function failJobAfterWorkflowError(input: {
  jobId: string;
  userId: string;
  errorMessage: string;
}): Promise<void> {
  "use step";

  const { db } = await import("@/lib/db");
  const now = new Date();
  await Promise.all([
    db.diligenceStageRun.updateMany({
      where: {
        jobId: input.jobId,
        status: DiligenceStageStatus.RUNNING,
      },
      data: {
        status: DiligenceStageStatus.FAILED,
        errorMessage: input.errorMessage,
        completedAt: now,
      },
    }),
    db.diligenceJob.updateMany({
      where: {
        id: input.jobId,
        userId: input.userId,
        status: { in: [DiligenceJobStatus.QUEUED, DiligenceJobStatus.RUNNING] },
      },
      data: {
        status: DiligenceJobStatus.FAILED,
        errorMessage: input.errorMessage,
        completedAt: now,
        lastHeartbeatAt: now,
      },
    }),
  ]);
}

export async function diligenceWorkflow(
  input: DiligenceWorkflowInput
): Promise<{ jobId: string; completed: boolean; stagesRun: number }> {
  "use workflow";

  const metadata = getWorkflowMetadata();
  await attachRunIdToJob({
    jobId: input.jobId,
    userId: input.userId,
    workflowRunId: metadata.workflowRunId,
  });

  let stagesRun = 0;
  try {
    while (true) {
      const result = await runStage({
        jobId: input.jobId,
        userId: input.userId,
      });
      stagesRun += 1;

      if (result.status === "completed") {
        return { jobId: input.jobId, completed: true, stagesRun };
      }
      if (result.status === "waiting_input") {
        return { jobId: input.jobId, completed: false, stagesRun };
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Diligence workflow failed.";
    await failJobAfterWorkflowError({
      jobId: input.jobId,
      userId: input.userId,
      errorMessage,
    });
    throw error;
  }
}
