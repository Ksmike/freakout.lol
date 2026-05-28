import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDiligenceJob = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
};

const mockDiligenceStageRun = {
  findMany: vi.fn(),
};

const mockDiligenceFinding = {
  findMany: vi.fn(),
};

const mockDiligenceClaim = {
  findMany: vi.fn(),
};

const mockDiligenceEntity = {
  findMany: vi.fn(),
};

const mockDiligenceContradiction = {
  findMany: vi.fn(),
};

const mockDiligenceArtifact = {
  findMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    diligenceJob: mockDiligenceJob,
    diligenceStageRun: mockDiligenceStageRun,
    diligenceFinding: mockDiligenceFinding,
    diligenceClaim: mockDiligenceClaim,
    diligenceEntity: mockDiligenceEntity,
    diligenceContradiction: mockDiligenceContradiction,
    diligenceArtifact: mockDiligenceArtifact,
  },
}));

vi.mock("@/lib/generated/prisma/client", () => ({
  ApiKeyProvider: { OPENAI: "OPENAI", ANTHROPIC: "ANTHROPIC", GOOGLE: "GOOGLE" },
  DiligenceJobStatus: {
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    WAITING_INPUT: "WAITING_INPUT",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELED: "CANCELED",
  },
  DiligenceStageName: {
    DOCUMENT_EXTRACTION: "DOCUMENT_EXTRACTION",
    ENTITY_EXTRACTION: "ENTITY_EXTRACTION",
  },
}));

const { DiligenceJobModel } = await import("@/lib/models/DiligenceJobModel");

describe("DiligenceJobModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a diligence job and returns the summary", async () => {
      const createdJob = {
        id: "job-1",
        status: "QUEUED",
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        currentStage: null,
        progressPercent: 0,
        attemptCount: 0,
        tokenUsageTotal: 0,
        estimatedCostUsd: null,
        errorMessage: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        completedAt: null,
      };
      mockDiligenceJob.create.mockResolvedValue(createdJob);

      const result = await DiligenceJobModel.create({
        projectId: "project-1",
        userId: "user-1",
        userApiKeyId: "key-1",
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        fallbackProviders: ["ANTHROPIC"],
        inputDocumentCount: 3,
        priority: 5,
      });

      expect(result).toEqual(createdJob);
      expect(mockDiligenceJob.create).toHaveBeenCalledWith({
        data: {
          projectId: "project-1",
          userId: "user-1",
          userApiKeyId: "key-1",
          selectedProvider: "OPENAI",
          selectedModel: "gpt-4o-mini",
          fallbackProviders: ["ANTHROPIC"],
          inputDocumentCount: 3,
          priority: 5,
          status: "QUEUED",
        },
        select: expect.objectContaining({ id: true, status: true }),
      });
    });

    it("defaults priority to 0 when not provided", async () => {
      mockDiligenceJob.create.mockResolvedValue({ id: "job-2" });

      await DiligenceJobModel.create({
        projectId: "project-1",
        userId: "user-1",
        userApiKeyId: "key-1",
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        fallbackProviders: [],
        inputDocumentCount: 1,
      });

      expect(mockDiligenceJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 0 }),
        })
      );
    });
  });

  describe("findLatestForProject", () => {
    it("returns the latest job summary when found", async () => {
      const job = {
        id: "job-1",
        status: "COMPLETED",
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        currentStage: null,
        progressPercent: 100,
        attemptCount: 1,
        tokenUsageTotal: 5000,
        estimatedCostUsd: 0.01,
        errorMessage: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        completedAt: new Date("2024-01-02"),
      };
      mockDiligenceJob.findFirst.mockResolvedValue(job);

      const result = await DiligenceJobModel.findLatestForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual(job);
      expect(mockDiligenceJob.findFirst).toHaveBeenCalledWith({
        where: { projectId: "project-1", userId: "user-1" },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({ id: true, status: true }),
      });
    });

    it("returns null when no job exists", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue(null);

      const result = await DiligenceJobModel.findLatestForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });
  });

  describe("getInsightsForProject", () => {
    it("returns null when no completed job exists", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue(null);

      const result = await DiligenceJobModel.getInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns insights from the latest completed job", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue({ id: "job-1" });
      mockDiligenceFinding.findMany.mockResolvedValue([
        { id: "r1", title: "Risk A", summary: "desc", confidence: 0.9 },
      ]);
      mockDiligenceClaim.findMany.mockResolvedValue([
        { id: "c1", claimText: "Claim A", confidence: 0.8 },
      ]);
      mockDiligenceEntity.findMany.mockResolvedValue([
        { id: "e1", name: "Entity A", kind: "PERSON", confidence: 0.7 },
      ]);
      mockDiligenceContradiction.findMany.mockResolvedValue([
        { id: "x1", statementA: "A", statementB: "B", confidence: 0.6 },
      ]);

      const result = await DiligenceJobModel.getInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual({
        risks: [{ id: "r1", title: "Risk A", summary: "desc", confidence: 0.9 }],
        claims: [{ id: "c1", claimText: "Claim A", confidence: 0.8 }],
        entities: [{ id: "e1", name: "Entity A", kind: "PERSON", confidence: 0.7 }],
        contradictions: [{ id: "x1", statementA: "A", statementB: "B", confidence: 0.6 }],
      });
    });
  });

  describe("getReportsForProject", () => {
    it("returns formatted report artifacts", async () => {
      const createdAt = new Date("2024-01-15");
      mockDiligenceArtifact.findMany.mockResolvedValue([
        {
          id: "art-1",
          jobId: "job-1",
          stage: "FINAL_REPORT",
          type: "GENERATED_REPORT",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          createdAt,
          job: { status: "COMPLETED", completedAt: createdAt },
        },
      ]);

      const result = await DiligenceJobModel.getReportsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual([
        {
          id: "art-1",
          jobId: "job-1",
          stage: "FINAL_REPORT",
          type: "GENERATED_REPORT",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          createdAt,
          jobStatus: "COMPLETED",
          jobCompletedAt: createdAt,
        },
      ]);
    });

    it("returns empty array when no reports exist", async () => {
      mockDiligenceArtifact.findMany.mockResolvedValue([]);

      const result = await DiligenceJobModel.getReportsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual([]);
    });
  });

  describe("getCompletedSnapshotsForProject", () => {
    it("returns completed jobs with grouped insight summaries", async () => {
      const completedAt = new Date("2024-02-01");
      mockDiligenceJob.findMany.mockResolvedValue([
        {
          id: "job-1",
          status: "COMPLETED",
          createdAt: new Date("2024-01-31"),
          completedAt,
          progressPercent: 100,
          tokenUsageTotal: 12000,
          estimatedCostUsd: 0.08,
        },
      ]);
      mockDiligenceFinding.findMany.mockResolvedValue([
        {
          id: "risk-1",
          jobId: "job-1",
          title: "Risk",
          summary: "Risk summary",
          confidence: 0.9,
        },
      ]);
      mockDiligenceClaim.findMany.mockResolvedValue([
        {
          id: "claim-1",
          jobId: "job-1",
          claimText: "Claim",
          confidence: 0.8,
        },
      ]);
      mockDiligenceEntity.findMany.mockResolvedValue([
        {
          id: "entity-1",
          jobId: "job-1",
          name: "Company",
          kind: "company",
          confidence: 0.7,
        },
      ]);
      mockDiligenceContradiction.findMany.mockResolvedValue([
        {
          id: "contradiction-1",
          jobId: "job-1",
          statementA: "A",
          statementB: "B",
          confidence: 0.6,
        },
      ]);

      const result = await DiligenceJobModel.getCompletedSnapshotsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual([
        {
          id: "job-1",
          status: "COMPLETED",
          createdAt: new Date("2024-01-31"),
          completedAt,
          progressPercent: 100,
          tokenUsageTotal: 12000,
          estimatedCostUsd: 0.08,
          insights: {
            risks: [
              {
                id: "risk-1",
                title: "Risk",
                summary: "Risk summary",
                confidence: 0.9,
              },
            ],
            claims: [
              {
                id: "claim-1",
                claimText: "Claim",
                confidence: 0.8,
              },
            ],
            entities: [
              {
                id: "entity-1",
                name: "Company",
                kind: "company",
                confidence: 0.7,
              },
            ],
            contradictions: [
              {
                id: "contradiction-1",
                statementA: "A",
                statementB: "B",
                confidence: 0.6,
              },
            ],
          },
        },
      ]);
      expect(mockDiligenceJob.findMany).toHaveBeenCalledWith({
        where: {
          projectId: "project-1",
          userId: "user-1",
          status: "COMPLETED",
        },
        orderBy: { completedAt: "asc" },
        select: expect.objectContaining({ id: true, completedAt: true }),
      });
    });

    it("returns an empty snapshot list without loading child rows", async () => {
      mockDiligenceJob.findMany.mockResolvedValue([]);

      const result = await DiligenceJobModel.getCompletedSnapshotsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual([]);
      expect(mockDiligenceFinding.findMany).not.toHaveBeenCalled();
      expect(mockDiligenceClaim.findMany).not.toHaveBeenCalled();
      expect(mockDiligenceEntity.findMany).not.toHaveBeenCalled();
      expect(mockDiligenceContradiction.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getFullInsightsForProject", () => {
    it("returns null when no completed job exists", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue(null);

      const result = await DiligenceJobModel.getFullInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns full insights with job data and stage runs", async () => {
      const completedJob = {
        id: "job-1",
        status: "COMPLETED",
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4o-mini",
        currentStage: null,
        progressPercent: 100,
        attemptCount: 1,
        tokenUsageTotal: 10000,
        estimatedCostUsd: 0.05,
        errorMessage: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        completedAt: new Date("2024-01-02"),
        stageRuns: [
          {
            stage: "DOCUMENT_EXTRACTION",
            status: "COMPLETED",
            attempts: 1,
            provider: "OPENAI",
            model: "gpt-4o-mini",
            tokenUsageTotal: 2000,
            estimatedCostUsd: 0.01,
            errorMessage: null,
            updatedAt: new Date("2024-01-01"),
          },
        ],
      };
      mockDiligenceJob.findFirst.mockResolvedValue(completedJob);
      mockDiligenceFinding.findMany.mockResolvedValue([]);
      mockDiligenceClaim.findMany.mockResolvedValue([]);
      mockDiligenceEntity.findMany.mockResolvedValue([]);
      mockDiligenceContradiction.findMany.mockResolvedValue([]);

      const result = await DiligenceJobModel.getFullInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).not.toBeNull();
      expect(result!.job.id).toBe("job-1");
      expect(result!.stageRuns).toHaveLength(1);
      expect(result!.findings).toEqual([]);
      expect(result!.claims).toEqual([]);
      expect(result!.entities).toEqual([]);
      expect(result!.contradictions).toEqual([]);
    });
  });

  describe("getRestrictedInsightsForProject", () => {
    it("returns null without loading output rows when no completed job exists", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue(null);

      const result = await DiligenceJobModel.getRestrictedInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toBeNull();
      expect(mockDiligenceFinding.findMany).not.toHaveBeenCalled();
      expect(mockDiligenceClaim.findMany).not.toHaveBeenCalled();
    });

    it("returns only allow-listed skeleton metadata for restricted viewers", async () => {
      mockDiligenceJob.findFirst.mockResolvedValue({ id: "job-1" });
      mockDiligenceFinding.findMany.mockResolvedValue([
        {
          type: "RISK",
          metadata: { severity: "HIGH", details: "Confidential finding detail" },
        },
        {
          type: "WARNING",
          metadata: { severity: "secret", details: "Confidential warning detail" },
        },
      ]);
      mockDiligenceClaim.findMany.mockResolvedValue([
        { status: "CONTRADICTED", confidence: 0.1 },
      ]);

      const result = await DiligenceJobModel.getRestrictedInsightsForProject({
        projectId: "project-1",
        userId: "user-1",
      });

      expect(result).toEqual({
        findings: [
          { type: "RISK", severity: "high" },
          { type: "WARNING", severity: null },
        ],
        claims: [{ status: "CONTRADICTED", confidence: 0.1 }],
      });
      expect(mockDiligenceFinding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { type: true, metadata: true },
        })
      );
      expect(mockDiligenceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { status: true, confidence: true },
        })
      );
      expect(JSON.stringify(result)).not.toContain("Confidential");
    });
  });
});
