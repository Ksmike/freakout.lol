import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB mock ──────────────────────────────────────────────────────────────────

const mockDb = {
  assistanceGoal: {
    findUnique: vi.fn(),
  },
  evidenceMapping: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  diligenceQuestionAnswer: {
    findMany: vi.fn(),
  },
  diligenceFinding: {
    findMany: vi.fn(),
  },
  diligenceClaim: {
    findMany: vi.fn(),
  },
  diligenceDocumentClassification: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { autoMapEvidenceForJob } = await import(
  "@/lib/diligence/evidence-mapper"
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  jobId: "job-1",
  projectId: "project-1",
  userId: "user-1",
  firmId: "firm-1",
};

function makeGoal(requirements: { id: string; nodeSlug: string; nodeKind: string; title: string }[]) {
  return {
    projectId: "project-1",
    graphId: "graph-1",
    graph: {
      evidenceRequirements: requirements.map((r) => ({
        id: r.id,
        title: r.title,
        priority: "high",
        node: {
          id: `node-${r.nodeSlug}`,
          slug: r.nodeSlug,
          kind: r.nodeKind,
          label: r.title,
        },
      })),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("autoMapEvidenceForJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing mappings, no diligence outputs
    mockDb.evidenceMapping.findMany.mockResolvedValue([]);
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([]);
    mockDb.diligenceFinding.findMany.mockResolvedValue([]);
    mockDb.diligenceClaim.findMany.mockResolvedValue([]);
    mockDb.diligenceDocumentClassification.findMany.mockResolvedValue([]);
  });

  it("returns 0 mapped when project has no assistance goal", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(null);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result).toEqual({ mapped: 0, skipped: 0 });
    expect(mockDb.evidenceMapping.upsert).not.toHaveBeenCalled();
  });

  it("returns 0 mapped when graph has no requirements", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(makeGoal([]));

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result).toEqual({ mapped: 0, skipped: 0 });
  });

  it("maps PARTIAL when a matching QuestionAnswer exists with low confidence", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "identity-ownership", nodeKind: "QUESTION", title: "Corporate registration" }])
    );
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([
      {
        question: "Q1_IDENTITY",
        summary: "Company is incorporated in Delaware.",
        confidence: 0.5,
        sourceCount: 1,
        chunkRefs: ["chunk-a", "chunk-b"],
      },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.mapped).toBe(1);
    expect(mockDb.evidenceMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "PARTIAL" }),
        update: expect.objectContaining({ status: "PARTIAL" }),
      })
    );
  });

  it("maps SATISFIED when QuestionAnswer has high confidence and multiple sources", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "market-traction", nodeKind: "QUESTION", title: "Revenue validation" }])
    );
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([
      {
        question: "Q3_MARKET",
        summary: "ARR is $2.4M with 3 signed contracts.",
        confidence: 0.85,
        sourceCount: 3,
        chunkRefs: ["chunk-x"],
      },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.mapped).toBe(1);
    expect(mockDb.evidenceMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "SATISFIED" }),
      })
    );
  });

  it("skips requirements already SATISFIED", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "identity-ownership", nodeKind: "QUESTION", title: "Cap table" }])
    );
    mockDb.evidenceMapping.findMany.mockResolvedValue([
      { requirementId: "req-1", status: "SATISFIED" },
    ]);
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([
      { question: "Q1_IDENTITY", summary: "...", confidence: 0.9, sourceCount: 5, chunkRefs: [] },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.skipped).toBe(1);
    expect(result.mapped).toBe(0);
    expect(mockDb.evidenceMapping.upsert).not.toHaveBeenCalled();
  });

  it("skips requirements already WAIVED", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "identity-ownership", nodeKind: "QUESTION", title: "IP ownership" }])
    );
    mockDb.evidenceMapping.findMany.mockResolvedValue([
      { requirementId: "req-1", status: "WAIVED" },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.skipped).toBe(1);
    expect(mockDb.evidenceMapping.upsert).not.toHaveBeenCalled();
  });

  it("skips when status would not change from existing PARTIAL", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "product-technology", nodeKind: "QUESTION", title: "Product demo" }])
    );
    mockDb.evidenceMapping.findMany.mockResolvedValue([
      { requirementId: "req-1", status: "PARTIAL" },
    ]);
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([
      { question: "Q2_PRODUCT", summary: "...", confidence: 0.4, sourceCount: 1, chunkRefs: [] },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.skipped).toBe(1);
    expect(mockDb.evidenceMapping.upsert).not.toHaveBeenCalled();
  });

  it("maps PARTIAL for RISK_CATEGORY node when matching findings exist", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-2", nodeSlug: "legal-risk", nodeKind: "RISK_CATEGORY", title: "Litigation and disputes" }])
    );
    mockDb.diligenceFinding.findMany.mockResolvedValue([
      { id: "finding-1", title: "Pending litigation", summary: "Company has an open dispute.", type: "RISK", confidence: 0.6, sourceCount: 1, chunkRefs: ["chunk-1"] },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.mapped).toBe(1);
    expect(mockDb.evidenceMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          findingRefs: ["finding-1"],
          status: "PARTIAL",
        }),
      })
    );
  });

  it("handles multiple requirements across different strategies", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([
        { id: "req-1", nodeSlug: "identity-ownership", nodeKind: "QUESTION", title: "Corporate registration" },
        { id: "req-2", nodeSlug: "unknown-node", nodeKind: "CONTROL", title: "Revenue contract terms" },
      ])
    );
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([
      { question: "Q1_IDENTITY", summary: "Incorporated in Delaware.", confidence: 0.8, sourceCount: 2, chunkRefs: ["c1"] },
    ]);
    mockDb.diligenceClaim.findMany.mockResolvedValue([
      { id: "claim-1", claimText: "Revenue contract terms are 12-month annual.", status: "SUPPORTED", confidence: 0.7, sourceCount: 2, chunkRefs: ["c2"] },
    ]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.mapped).toBe(2);
  });

  it("returns 0 mapped when no diligence outputs match any requirement", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(
      makeGoal([{ id: "req-1", nodeSlug: "identity-ownership", nodeKind: "QUESTION", title: "Corporate registration" }])
    );
    // No question answers for Q1_IDENTITY
    mockDb.diligenceQuestionAnswer.findMany.mockResolvedValue([]);

    const result = await autoMapEvidenceForJob(BASE_INPUT);

    expect(result.mapped).toBe(0);
    expect(result.skipped).toBe(1); // OPEN → OPEN, no change
  });
});
