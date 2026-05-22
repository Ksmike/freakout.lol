import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  diligenceJob: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  diligenceStageRun: {
    upsert: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  diligenceArtifact: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  diligenceChunk: {
    findMany: vi.fn().mockResolvedValue([]),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  diligenceEntity: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  diligenceClaim: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
  diligenceFinding: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  diligenceContradiction: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  diligenceQuestionAnswer: {
    upsert: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  diligenceEvidenceGap: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  diligenceOpenQuestion: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  diligenceDocumentClassification: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  project: {
    updateMany: vi.fn(),
    findUnique: vi.fn().mockResolvedValue({ firmId: "firm-1" }),
  },
  projectDocument: {
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/generated/prisma/client", () => ({
  ApiKeyProvider: { OPENAI: "OPENAI", ANTHROPIC: "ANTHROPIC", GOOGLE: "GOOGLE" },
  DiligenceArtifactType: {
    EXTRACTED_TEXT: "EXTRACTED_TEXT",
    GENERATED_REPORT: "GENERATED_REPORT",
  },
  DiligenceJobStatus: {
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELED: "CANCELED",
    WAITING_INPUT: "WAITING_INPUT",
  },
  DiligenceStageName: {
    DOCUMENT_EXTRACTION: "DOCUMENT_EXTRACTION",
    DOCUMENT_CLASSIFICATION: "DOCUMENT_CLASSIFICATION",
    EVIDENCE_INDEXING: "EVIDENCE_INDEXING",
    ENTITY_EXTRACTION: "ENTITY_EXTRACTION",
    CLAIM_EXTRACTION: "CLAIM_EXTRACTION",
    CORROBORATION: "CORROBORATION",
    Q1_IDENTITY_AND_OWNERSHIP: "Q1_IDENTITY_AND_OWNERSHIP",
    Q2_PRODUCT_AND_TECHNOLOGY: "Q2_PRODUCT_AND_TECHNOLOGY",
    Q3_MARKET_AND_TRACTION: "Q3_MARKET_AND_TRACTION",
    Q4_EXECUTION_CAPABILITY: "Q4_EXECUTION_CAPABILITY",
    Q5_BUSINESS_MODEL_VIABILITY: "Q5_BUSINESS_MODEL_VIABILITY",
    Q6_RISK_ANALYSIS: "Q6_RISK_ANALYSIS",
    Q7_EVIDENCE_QUALITY: "Q7_EVIDENCE_QUALITY",
    Q8_FAILURE_MODES_AND_FRAGILITY: "Q8_FAILURE_MODES_AND_FRAGILITY",
    OPEN_QUESTIONS: "OPEN_QUESTIONS",
    EXECUTIVE_SUMMARY: "EXECUTIVE_SUMMARY",
    FINAL_REPORT: "FINAL_REPORT",
  },
  DiligenceStageStatus: {
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  },
  DiligenceStorageProvider: { JSON_COLUMN: "JSON_COLUMN" },
  DiligenceCoreQuestion: {
    Q1_IDENTITY: "Q1_IDENTITY",
    Q2_PRODUCT: "Q2_PRODUCT",
    Q3_MARKET: "Q3_MARKET",
    Q4_EXECUTION: "Q4_EXECUTION",
    Q5_BUSINESS_MODEL: "Q5_BUSINESS_MODEL",
    Q6_RISKS: "Q6_RISKS",
    Q7_EVIDENCE: "Q7_EVIDENCE",
    Q8_FAILURE_MODES: "Q8_FAILURE_MODES",
  },
  ProjectDocumentProcessingStatus: {
    PROCESSING: "PROCESSING",
    PROCESSED: "PROCESSED",
    FAILED: "FAILED",
  },
}));

vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
  list: vi.fn().mockResolvedValue({ blobs: [] }),
}));

vi.mock("@/lib/blob/documents", () => ({
  buildProjectBlobPrefix: vi
    .fn()
    .mockReturnValue("users/user-1/projects/proj-1/"),
}));

const mockInvokeStructured = vi.fn();
vi.mock("@/lib/diligence/diligence-llm-service", () => ({
  DiligenceLLMService: class {
    invokeStructured = mockInvokeStructured;
  },
}));

vi.mock("@/lib/diligence/evidence-mapper", () => ({
  autoMapEvidenceForJob: vi.fn().mockResolvedValue({ mapped: 0, skipped: 0 }),
}));

vi.mock("@/lib/diligence/stages", () => ({
  STAGE_TO_QUESTION: {
    Q1_IDENTITY_AND_OWNERSHIP: "Q1_IDENTITY",
    Q6_RISK_ANALYSIS: "Q6_RISKS",
    Q8_FAILURE_MODES_AND_FRAGILITY: "Q8_FAILURE_MODES",
  },
  getNextStage: vi.fn(),
  getStageProgressPercent: vi.fn().mockReturnValue(50),
}));

const mockFindByIdForUser = vi.fn();
const mockFindForUser = vi.fn();
const mockDecryptApiKey = vi.fn();

vi.mock("@/lib/models/UserApiKeyModel", () => ({
  UserApiKeyModel: {
    findByIdForUser: (...args: unknown[]) => mockFindByIdForUser(...args),
    findForUser: (...args: unknown[]) => mockFindForUser(...args),
    decryptApiKey: (...args: unknown[]) => mockDecryptApiKey(...args),
  },
}));

const { DiligenceWorker } = await import("@/lib/diligence/diligence-worker");
const { getNextStage } = await import("@/lib/diligence/stages");

const baseJob = {
  id: "job-1",
  userId: "user-1",
  projectId: "proj-1",
  status: "RUNNING",
  currentStage: null,
  selectedProvider: "OPENAI",
  selectedModel: "gpt-4o-mini",
  fallbackProviders: [],
  userApiKeyId: "key-1",
  tokenUsageTotal: 0,
  estimatedCostUsd: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.diligenceArtifact.findMany.mockResolvedValue([]);
  mockDb.diligenceChunk.findMany.mockResolvedValue([]);
  mockDb.diligenceEntity.findMany.mockResolvedValue([]);
  mockDb.diligenceClaim.findMany.mockResolvedValue([]);
  mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([]);
  mockDb.diligenceEvidenceGap.findMany.mockResolvedValue([]);
  mockDb.diligenceDocumentClassification.findMany.mockResolvedValue([]);
  mockFindByIdForUser.mockResolvedValue({
    id: "key-1",
    enabled: true,
    encryptedKey: "x",
    provider: "OPENAI",
    defaultModel: "gpt-4o-mini",
  });
  mockDecryptApiKey.mockReturnValue("sk-test");
});

describe("DiligenceWorker — lifecycle", () => {
  it("returns completed when job is already terminal", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue({
      ...baseJob,
      status: "COMPLETED",
    });
    const worker = new DiligenceWorker();
    const result = await worker.runNextStage({
      jobId: "job-1",
      userId: "user-1",
    });
    expect(result.status).toBe("completed");
  });

  it("keeps the job RUNNING when a stage throws a transient error", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "ENTITY_EXTRACTION"
    );
    mockInvokeStructured.mockRejectedValue(new Error("LLM exploded"));

    const worker = new DiligenceWorker();
    await expect(
      worker.runNextStage({ jobId: "job-1", userId: "user-1" })
    ).rejects.toThrow("LLM exploded");

    const updateCalls = mockDb.diligenceJob.update.mock.calls;
    const failedCall = updateCalls.find((args) => {
      const data = (args[0] as { data: { status?: string } }).data;
      return data.status === "FAILED";
    });
    expect(failedCall).toBeUndefined();

    const stageRunUpdates = mockDb.diligenceStageRun.update.mock.calls;
    const stageFailed = stageRunUpdates.find((args) => {
      const data = (args[0] as { data: { status?: string } }).data;
      return data.status === "FAILED";
    });
    expect(stageFailed).toBeDefined();
  });

  it("marks the job FAILED when a stage throws DiligenceFatalError", async () => {
    const { DiligenceFatalError } = await import("@/lib/diligence/errors");
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "ENTITY_EXTRACTION"
    );
    mockInvokeStructured.mockRejectedValue(
      new DiligenceFatalError("Selected API key is missing or disabled.")
    );

    const worker = new DiligenceWorker();
    await expect(
      worker.runNextStage({ jobId: "job-1", userId: "user-1" })
    ).rejects.toThrow("Selected API key is missing or disabled.");

    const updateCalls = mockDb.diligenceJob.update.mock.calls;
    const failedCall = updateCalls.find((args) => {
      const data = (args[0] as { data: { status?: string } }).data;
      return data.status === "FAILED";
    });
    expect(failedCall).toBeDefined();
  });
});

describe("DiligenceWorker — CORROBORATION", () => {
  it("computes SUPPORTED status when ≥2 distinct documents cite a claim", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "CORROBORATION"
    );
    mockDb.diligenceClaim.findMany.mockResolvedValue([
      {
        id: "claim-1",
        claimText: "ARR is $4M",
        chunkRefs: ["c1", "c2"],
        evidenceRefs: { category: "revenue", quantitative: true, value: "4000000", unit: "USD", period: "2024" },
      },
    ]);
    mockDb.diligenceChunk.findMany.mockResolvedValue([
      { id: "c1", documentFilename: "deck.pdf", documentPathname: "deck.pdf", page: 1, text: "Pitch deck content." },
      { id: "c2", documentFilename: "financials.pdf", documentPathname: "financials.pdf", page: 1, text: "Financial data." },
    ]);

    const worker = new DiligenceWorker();
    const result = await worker.runNextStage({
      jobId: "job-1",
      userId: "user-1",
    });

    expect(result.status).toMatch(/progressed|completed/);
    const updateArgs = mockDb.diligenceClaim.update.mock.calls[0]?.[0] as
      | { data: { status?: string; sourceCount?: number; confidence?: number } }
      | undefined;
    expect(updateArgs?.data.status).toBe("SUPPORTED");
    expect(updateArgs?.data.sourceCount).toBe(2);
    expect(updateArgs?.data.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("computes INCONCLUSIVE for a single-source claim", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "CORROBORATION"
    );
    mockDb.diligenceClaim.findMany.mockResolvedValue([
      {
        id: "claim-1",
        claimText: "We are best-in-class",
        chunkRefs: ["c1"],
        evidenceRefs: {},
      },
    ]);
    mockDb.diligenceChunk.findMany.mockResolvedValue([
      { id: "c1", documentFilename: "deck.pdf", documentPathname: "deck.pdf", page: 1, text: "Pitch deck content." },
    ]);

    const worker = new DiligenceWorker();
    await worker.runNextStage({ jobId: "job-1", userId: "user-1" });

    const updateArgs = mockDb.diligenceClaim.update.mock.calls[0]?.[0] as
      | { data: { status?: string; sourceCount?: number } }
      | undefined;
    expect(updateArgs?.data.status).toBe("INCONCLUSIVE");
    expect(updateArgs?.data.sourceCount).toBe(1);
  });
});

describe("DiligenceWorker — question-stage persistence", () => {
  it("persists a DiligenceQuestionAnswer for a Q-stage", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "Q1_IDENTITY_AND_OWNERSHIP"
    );
    mockInvokeStructured.mockResolvedValue({
      provider: "OPENAI",
      model: "gpt-4o-mini",
      parsed: {
        summary: "Identity assessed.",
        confidence: 0.7,
        chunk_refs_overall: ["c1"],
        items: [{ key: "legal_name", value: "Acme Inc." }],
        identity: { legal_name: "Acme Inc.", chunk_refs: ["c1"] },
      },
      usage: { input_tokens: 100, output_tokens: 50 },
      rawText: "{}",
    });
    mockDb.diligenceChunk.findMany.mockResolvedValue([
      { id: "c1", documentFilename: "incorp.pdf", documentPathname: "incorp.pdf", page: 1, text: "Acme Inc. was incorporated in Delaware." },
    ]);

    const worker = new DiligenceWorker();
    await worker.runNextStage({ jobId: "job-1", userId: "user-1" });

    expect(mockDb.diligenceQuestionAnswer.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = mockDb.diligenceQuestionAnswer.upsert.mock.calls[0]?.[0] as {
      where: { jobId_question: { question: string } };
      create: { question: string; sourceCount: number };
    };
    expect(upsertArgs.where.jobId_question.question).toBe("Q1_IDENTITY");
    expect(upsertArgs.create.sourceCount).toBe(1);
  });

  it("persists evidence gaps when the LLM emits them", async () => {
    mockDb.diligenceJob.findFirst.mockResolvedValue(baseJob);
    (getNextStage as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue(
      "Q6_RISK_ANALYSIS"
    );
    mockInvokeStructured.mockResolvedValue({
      provider: "OPENAI",
      model: "gpt-4o-mini",
      parsed: {
        summary: "",
        risks: [],
        items: [],
        evidence_gaps: [
          {
            title: "No SOC2 evidence found",
            description: "...",
            severity: "high",
            suggested_source: "audit report",
          },
        ],
      },
      usage: {},
      rawText: "{}",
    });

    const worker = new DiligenceWorker();
    await worker.runNextStage({ jobId: "job-1", userId: "user-1" });

    expect(mockDb.diligenceEvidenceGap.createMany).toHaveBeenCalledTimes(1);
    const data = (mockDb.diligenceEvidenceGap.createMany.mock.calls[0]?.[0] as {
      data: Array<{ question: string; severity: string }>;
    }).data;
    expect(data[0]?.question).toBe("Q6_RISKS");
    expect(data[0]?.severity).toBe("high");
  });
});
