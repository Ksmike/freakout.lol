import { db } from "@/lib/db";
import { DiligenceLLMService } from "@/lib/diligence/diligence-llm-service";
import { DiligenceFatalError } from "@/lib/diligence/errors";
import { getStageProgressPercent, getNextStage } from "@/lib/diligence/stages";
import { runDocumentExtraction } from "@/lib/diligence/stages/document-extraction";
import { runEvidenceIndexing } from "@/lib/diligence/stages/evidence-indexing";
import { runCorroboration } from "@/lib/diligence/stages/corroboration";
import { runLlmStage } from "@/lib/diligence/stages/llm-stage";
import { logger } from "@/lib/logger";
import {
  toNonNegativeNumber,
  toInputJson,
  type StageContext,
  type StageExecutionResult,
} from "@/lib/diligence/stage-helpers";
import {
  ApiKeyProvider,
  DiligenceJobStatus,
  DiligenceStageName,
  DiligenceStageStatus,
  ProjectStatus as PrismaProjectStatus,
} from "@/lib/generated/prisma/client";

export class DiligenceWorker {
  private readonly llmService = new DiligenceLLMService();

  async runNextStage(input: {
    jobId: string;
    userId: string;
  }): Promise<{
    status: "completed" | "progressed" | "waiting_input";
    stage?: DiligenceStageName;
  }> {
    const job = await db.diligenceJob.findFirst({
      where: { id: input.jobId, userId: input.userId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        status: true,
        currentStage: true,
        selectedProvider: true,
        selectedModel: true,
        fallbackProviders: true,
        userApiKeyId: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
      },
    });

    if (!job) {
      throw new DiligenceFatalError("Diligence job not found.");
    }
    if (
      job.status === DiligenceJobStatus.COMPLETED ||
      job.status === DiligenceJobStatus.CANCELED
    ) {
      return { status: "completed" };
    }

    const nextStage = getNextStage(job.currentStage);
    if (!nextStage) {
      await this.markJobCompleted(job.id, job.projectId, job.userId);
      return { status: "completed" };
    }

    await db.diligenceJob.update({
      where: { id: job.id },
      data: {
        status: DiligenceJobStatus.RUNNING,
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
        attemptCount: { increment: 1 },
        errorMessage: null,
      },
    });

    await db.diligenceStageRun.upsert({
      where: { jobId_stage: { jobId: job.id, stage: nextStage } },
      create: {
        jobId: job.id,
        stage: nextStage,
        status: DiligenceStageStatus.RUNNING,
        attempts: 1,
        startedAt: new Date(),
      },
      update: {
        status: DiligenceStageStatus.RUNNING,
        attempts: { increment: 1 },
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      },
    });

    try {
      const context: StageContext = {
        stage: nextStage,
        jobId: job.id,
        projectId: job.projectId,
        userId: job.userId,
        selectedProvider: job.selectedProvider,
        selectedModel: job.selectedModel,
        fallbackProviders: Array.isArray(job.fallbackProviders)
          ? (job.fallbackProviders.filter(
              (value) => typeof value === "string"
            ) as ApiKeyProvider[])
          : [],
        userApiKeyId: job.userApiKeyId,
      };

      const stageResult = await this.executeStage(context);

      const tokenUsageTotal = toNonNegativeNumber(stageResult.tokenUsageTotal);
      const estimatedCostUsd = toNonNegativeNumber(stageResult.estimatedCostUsd);

      await db.diligenceStageRun.update({
        where: { jobId_stage: { jobId: job.id, stage: nextStage } },
        data: {
          status: DiligenceStageStatus.COMPLETED,
          provider: stageResult.provider ?? null,
          model: stageResult.model ?? null,
          tokenUsageTotal,
          estimatedCostUsd,
          outputJson: toInputJson(stageResult.outputJson),
          completedAt: new Date(),
          outputArtifactCount: Array.isArray(stageResult.outputJson.items)
            ? (stageResult.outputJson.items as unknown[]).length
            : 0,
        },
      });

      const nextProgress = getStageProgressPercent(nextStage);
      const isCompleted = nextProgress >= 100;

      await db.diligenceJob.update({
        where: { id: job.id },
        data: {
          currentStage: nextStage,
          progressPercent: nextProgress,
          tokenUsageTotal: { increment: tokenUsageTotal },
          estimatedCostUsd:
            toNonNegativeNumber(job.estimatedCostUsd) + estimatedCostUsd,
          status: isCompleted
            ? DiligenceJobStatus.COMPLETED
            : DiligenceJobStatus.RUNNING,
          completedAt: isCompleted ? new Date() : null,
          lastHeartbeatAt: new Date(),
        },
      });

      if (isCompleted) {
        await db.project.updateMany({
          where: { id: job.projectId, userId: job.userId },
          data: { status: PrismaProjectStatus.REVIEWED },
        });

        // Auto-map evidence to graph requirements (best-effort)
        try {
          const project = await db.project.findUnique({
            where: { id: job.projectId },
            select: { firmId: true },
          });
          if (project) {
            const { autoMapEvidenceForJob } = await import(
              "@/lib/diligence/evidence-mapper"
            );
            await autoMapEvidenceForJob({
              jobId: job.id,
              projectId: job.projectId,
              userId: job.userId,
              firmId: project.firmId,
            });
          }
        } catch {
          // Mapping failure must never fail the job completion path.
        }

        return { status: "completed", stage: nextStage };
      }

      return { status: "progressed", stage: nextStage };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stage execution failed.";
      const isFatal = error instanceof DiligenceFatalError;

      await db.diligenceStageRun.update({
        where: { jobId_stage: { jobId: job.id, stage: nextStage } },
        data: {
          status: DiligenceStageStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      // Only mark the job terminally FAILED for fatal errors. Transient errors
      // (LLM rate limits, network blips, parse failures) keep the job in
      // RUNNING so Vercel Workflow can retry the stage.
      await db.diligenceJob.update({
        where: { id: job.id },
        data: {
          status: isFatal ? DiligenceJobStatus.FAILED : DiligenceJobStatus.RUNNING,
          errorMessage: message,
          lastHeartbeatAt: new Date(),
        },
      });

      const logLevel = isFatal ? "error" : "warn";
      logger[logLevel]("diligence.stage_failed", {
        jobId: job.id,
        projectId: job.projectId,
        userId: job.userId,
        stage: nextStage,
        fatal: isFatal,
        error_message: message,
      }, error);

      throw error;
    }
  }

  private async markJobCompleted(jobId: string, projectId: string, userId: string) {
    await db.diligenceJob.update({
      where: { id: jobId },
      data: {
        status: DiligenceJobStatus.COMPLETED,
        completedAt: new Date(),
        progressPercent: 100,
      },
    });
    await db.project.updateMany({
      where: { id: projectId, userId },
      data: { status: PrismaProjectStatus.REVIEWED },
    });

    // Auto-map evidence to graph requirements (best-effort — never blocks completion)
    try {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { firmId: true },
      });
      if (project) {
        const { autoMapEvidenceForJob } = await import(
          "@/lib/diligence/evidence-mapper"
        );
        await autoMapEvidenceForJob({ jobId, projectId, userId, firmId: project.firmId });
      }
    } catch {
      // Mapping failure must never fail the job completion path.
    }
  }

  private async executeStage(ctx: StageContext): Promise<StageExecutionResult> {
    switch (ctx.stage) {
      case DiligenceStageName.DOCUMENT_EXTRACTION:
        return runDocumentExtraction(ctx);
      case DiligenceStageName.EVIDENCE_INDEXING:
        return runEvidenceIndexing(ctx);
      case DiligenceStageName.CORROBORATION:
        return runCorroboration(ctx);
      default:
        return runLlmStage(ctx, this.llmService);
    }
  }
}
