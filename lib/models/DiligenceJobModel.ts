import { db } from "@/lib/db";
import {
  type ApiKeyProvider,
  DiligenceJobStatus,
  type DiligenceStageName,
  type DiligenceStageStatus,
} from "@/lib/generated/prisma/client";
import { asNullableString, asRecord } from "@/lib/utils/coerce";

export type DiligenceJobSummary = {
  id: string;
  status: DiligenceJobStatus;
  selectedProvider: ApiKeyProvider;
  selectedModel: string;
  currentStage: DiligenceStageName | null;
  progressPercent: number;
  attemptCount: number;
  tokenUsageTotal: number;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type DiligenceStageRunSummary = {
  stage: DiligenceStageName;
  status: DiligenceStageStatus;
  attempts: number;
  provider: ApiKeyProvider | null;
  model: string | null;
  tokenUsageTotal: number;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
  updatedAt: Date;
};

export type DiligenceInsightsSummary = {
  risks: Array<{ id: string; title: string; summary: string; confidence: number | null }>;
  claims: Array<{ id: string; claimText: string; confidence: number | null }>;
  entities: Array<{ id: string; name: string; kind: string; confidence: number | null }>;
  contradictions: Array<{
    id: string;
    statementA: string;
    statementB: string;
    confidence: number | null;
  }>;
};

export type DiligenceSnapshotSummary = {
  id: string;
  status: DiligenceJobStatus;
  createdAt: Date;
  completedAt: Date | null;
  progressPercent: number;
  tokenUsageTotal: number;
  estimatedCostUsd: number | null;
  insights: DiligenceInsightsSummary;
};

export type RestrictedDiligenceInsights = {
  findings: Array<{ type: string; severity: string | null }>;
  claims: Array<{ status: string; confidence: number | null }>;
};

const VISIBLE_FINDING_SEVERITIES = new Set(["critical", "high", "medium", "low"]);

function getVisibleFindingSeverity(metadata: unknown): string | null {
  const severity = asNullableString(asRecord(metadata).severity)?.toLowerCase() ?? null;

  return severity && VISIBLE_FINDING_SEVERITIES.has(severity) ? severity : null;
}

function toJobSummary(
  row: {
    id: string;
    status: DiligenceJobStatus;
    selectedProvider: ApiKeyProvider;
    selectedModel: string;
    currentStage: DiligenceStageName | null;
    progressPercent: number;
    attemptCount: number;
    tokenUsageTotal: number;
    estimatedCostUsd: number | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  } | null
): DiligenceJobSummary | null {
  if (!row) {
    return null;
  }
  return row;
}

export const DiligenceJobModel = {
  async create(input: {
    projectId: string;
    userId: string;
    userApiKeyId: string;
    selectedProvider: ApiKeyProvider;
    selectedModel: string;
    fallbackProviders: ApiKeyProvider[];
    inputDocumentCount: number;
    priority?: number;
  }): Promise<DiligenceJobSummary> {
    const job = await db.diligenceJob.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        userApiKeyId: input.userApiKeyId,
        selectedProvider: input.selectedProvider,
        selectedModel: input.selectedModel,
        fallbackProviders: input.fallbackProviders,
        inputDocumentCount: input.inputDocumentCount,
        priority: input.priority ?? 0,
        status: DiligenceJobStatus.QUEUED,
      },
      select: {
        id: true,
        status: true,
        selectedProvider: true,
        selectedModel: true,
        currentStage: true,
        progressPercent: true,
        attemptCount: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    return job;
  },

  async findLatestForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<DiligenceJobSummary | null> {
    const job = await db.diligenceJob.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        selectedProvider: true,
        selectedModel: true,
        currentStage: true,
        progressPercent: true,
        attemptCount: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    return toJobSummary(job);
  },

  async findByIdForUser(input: {
    jobId: string;
    userId: string;
  }): Promise<
    | (DiligenceJobSummary & {
        projectId: string;
        userApiKeyId: string | null;
        fallbackProviders: ApiKeyProvider[] | null;
        priority: number;
      })
    | null
  > {
    const job = await db.diligenceJob.findFirst({
      where: {
        id: input.jobId,
        userId: input.userId,
      },
      select: {
        id: true,
        projectId: true,
        userApiKeyId: true,
        selectedProvider: true,
        selectedModel: true,
        fallbackProviders: true,
        status: true,
        currentStage: true,
        progressPercent: true,
        attemptCount: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        priority: true,
      },
    });

    if (!job) {
      return null;
    }

    return {
      ...job,
      fallbackProviders: Array.isArray(job.fallbackProviders)
        ? (job.fallbackProviders.filter((value) => typeof value === "string") as ApiKeyProvider[])
        : null,
    };
  },

  async listStages(jobId: string): Promise<DiligenceStageRunSummary[]> {
    const stageRuns = await db.diligenceStageRun.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
      select: {
        stage: true,
        status: true,
        attempts: true,
        provider: true,
        model: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        updatedAt: true,
      },
    });
    return stageRuns;
  },

  async findLatestWithStagesForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<
    | (DiligenceJobSummary & {
        stageRuns: DiligenceStageRunSummary[];
      })
    | null
  > {
    const job = await db.diligenceJob.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        selectedProvider: true,
        selectedModel: true,
        currentStage: true,
        progressPercent: true,
        attemptCount: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        stageRuns: {
          orderBy: { createdAt: "asc" },
          select: {
            stage: true,
            status: true,
            attempts: true,
            provider: true,
            model: true,
            tokenUsageTotal: true,
            estimatedCostUsd: true,
            errorMessage: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    return job;
  },

  async getInsightsForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<DiligenceInsightsSummary | null> {
    const latestCompletedJob = await db.diligenceJob.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        status: DiligenceJobStatus.COMPLETED,
      },
      orderBy: {
        completedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    if (!latestCompletedJob) {
      return null;
    }

    const [risks, claims, entities, contradictions] = await Promise.all([
      db.diligenceFinding.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
          type: "RISK",
        },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: {
          id: true,
          title: true,
          summary: true,
          confidence: true,
        },
      }),
      db.diligenceClaim.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: {
          id: true,
          claimText: true,
          confidence: true,
        },
      }),
      db.diligenceEntity.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          id: true,
          name: true,
          kind: true,
          confidence: true,
        },
      }),
      db.diligenceContradiction.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: {
          id: true,
          statementA: true,
          statementB: true,
          confidence: true,
        },
      }),
    ]);

    return {
      risks,
      claims,
      entities,
      contradictions,
    };
  },

  async getCompletedSnapshotsForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<DiligenceSnapshotSummary[]> {
    const jobs = await db.diligenceJob.findMany({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        status: DiligenceJobStatus.COMPLETED,
      },
      orderBy: {
        completedAt: "asc",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        progressPercent: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
      },
    });

    if (jobs.length === 0) {
      return [];
    }

    const jobIds = jobs.map((job) => job.id);
    const [findings, claims, entities, contradictions] = await Promise.all([
      db.diligenceFinding.findMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          jobId: { in: jobIds },
          type: "RISK",
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          jobId: true,
          title: true,
          summary: true,
          confidence: true,
        },
      }),
      db.diligenceClaim.findMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          jobId: { in: jobIds },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          jobId: true,
          claimText: true,
          confidence: true,
        },
      }),
      db.diligenceEntity.findMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          jobId: { in: jobIds },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          jobId: true,
          name: true,
          kind: true,
          confidence: true,
        },
      }),
      db.diligenceContradiction.findMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
          jobId: { in: jobIds },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          jobId: true,
          statementA: true,
          statementB: true,
          confidence: true,
        },
      }),
    ]);

    return jobs.map((job) => ({
      ...job,
      insights: {
        risks: findings
          .filter((finding) => finding.jobId === job.id)
          .slice(0, 6)
          .map((finding) => ({
            id: finding.id,
            title: finding.title,
            summary: finding.summary,
            confidence: finding.confidence,
          })),
        claims: claims
          .filter((claim) => claim.jobId === job.id)
          .slice(0, 6)
          .map((claim) => ({
            id: claim.id,
            claimText: claim.claimText,
            confidence: claim.confidence,
          })),
        entities: entities
          .filter((entity) => entity.jobId === job.id)
          .slice(0, 8)
          .map((entity) => ({
            id: entity.id,
            name: entity.name,
            kind: entity.kind,
            confidence: entity.confidence,
          })),
        contradictions: contradictions
          .filter((contradiction) => contradiction.jobId === job.id)
          .slice(0, 6)
          .map((contradiction) => ({
            id: contradiction.id,
            statementA: contradiction.statementA,
            statementB: contradiction.statementB,
            confidence: contradiction.confidence,
          })),
      },
    }));
  },

  async getRestrictedInsightsForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<RestrictedDiligenceInsights | null> {
    const latestCompletedJob = await db.diligenceJob.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        status: DiligenceJobStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });

    if (!latestCompletedJob) {
      return null;
    }

    const [findings, claims] = await Promise.all([
      db.diligenceFinding.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          type: true,
          metadata: true,
        },
      }),
      db.diligenceClaim.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          confidence: true,
        },
      }),
    ]);

    return {
      findings: findings.map((finding) => ({
        type: finding.type,
        severity: getVisibleFindingSeverity(finding.metadata),
      })),
      claims,
    };
  },

  async getFullInsightsForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<{
    job: DiligenceJobSummary;
    findings: Array<{
      id: string;
      type: string;
      title: string;
      summary: string;
      confidence: number | null;
      metadata: unknown;
      createdAt: Date;
    }>;
    claims: Array<{
      id: string;
      claimText: string;
      status: string;
      confidence: number | null;
      evidenceRefs: unknown;
      createdAt: Date;
    }>;
    entities: Array<{
      id: string;
      name: string;
      kind: string;
      confidence: number | null;
      metadata: unknown;
      createdAt: Date;
    }>;
    contradictions: Array<{
      id: string;
      statementA: string;
      statementB: string;
      confidence: number | null;
      evidenceRefs: unknown;
      createdAt: Date;
    }>;
    stageRuns: DiligenceStageRunSummary[];
  } | null> {
    const latestCompletedJob = await db.diligenceJob.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        status: DiligenceJobStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        status: true,
        selectedProvider: true,
        selectedModel: true,
        currentStage: true,
        progressPercent: true,
        attemptCount: true,
        tokenUsageTotal: true,
        estimatedCostUsd: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        stageRuns: {
          orderBy: { createdAt: "asc" },
          select: {
            stage: true,
            status: true,
            attempts: true,
            provider: true,
            model: true,
            tokenUsageTotal: true,
            estimatedCostUsd: true,
            errorMessage: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!latestCompletedJob) {
      return null;
    }

    const [findings, claims, entities, contradictions] = await Promise.all([
      db.diligenceFinding.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          summary: true,
          confidence: true,
          metadata: true,
          createdAt: true,
        },
      }),
      db.diligenceClaim.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          claimText: true,
          status: true,
          confidence: true,
          evidenceRefs: true,
          createdAt: true,
        },
      }),
      db.diligenceEntity.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          kind: true,
          confidence: true,
          metadata: true,
          createdAt: true,
        },
      }),
      db.diligenceContradiction.findMany({
        where: {
          jobId: latestCompletedJob.id,
          projectId: input.projectId,
          userId: input.userId,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          statementA: true,
          statementB: true,
          confidence: true,
          evidenceRefs: true,
          createdAt: true,
        },
      }),
    ]);

    const { stageRuns, ...jobData } = latestCompletedJob;

    return {
      job: jobData,
      findings,
      claims,
      entities,
      contradictions,
      stageRuns,
    };
  },

  async getReportsForProject(input: {
    projectId: string;
    userId: string;
  }): Promise<
    Array<{
      id: string;
      jobId: string;
      stage: string | null;
      type: string;
      mimeType: string | null;
      sizeBytes: number | null;
      createdAt: Date;
      jobStatus: string;
      jobCompletedAt: Date | null;
    }>
  > {
    const artifacts = await db.diligenceArtifact.findMany({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        type: {
          in: ["GENERATED_REPORT", "EXPORT_BUNDLE", "EVIDENCE_MAP"],
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobId: true,
        stage: true,
        type: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        job: {
          select: {
            status: true,
            completedAt: true,
          },
        },
      },
    });

    return artifacts.map((a) => ({
      id: a.id,
      jobId: a.jobId,
      stage: a.stage,
      type: a.type,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
      jobStatus: a.job.status,
      jobCompletedAt: a.job.completedAt,
    }));
  },
};
