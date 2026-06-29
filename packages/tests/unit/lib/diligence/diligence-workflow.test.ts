import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunNextStage = vi.fn();
const mockUpdateMany = vi.fn();
const mockStageRunUpdateMany = vi.fn();

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "FatalError";
    }
  },
  getWorkflowMetadata: () => ({ workflowRunId: "wf-run-123" }),
}));

vi.mock("@/lib/diligence/diligence-worker", () => ({
  DiligenceWorker: class {
    runNextStage = mockRunNextStage;
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    diligenceJob: {
      updateMany: mockUpdateMany,
    },
    diligenceStageRun: {
      updateMany: mockStageRunUpdateMany,
    },
  },
}));

vi.mock("@/lib/generated/prisma/client", () => ({
  DiligenceJobStatus: {
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    FAILED: "FAILED",
  },
  DiligenceStageName: {
    DOCUMENT_EXTRACTION: "DOCUMENT_EXTRACTION",
    DOCUMENT_CLASSIFICATION: "DOCUMENT_CLASSIFICATION",
  },
  DiligenceStageStatus: {
    RUNNING: "RUNNING",
    FAILED: "FAILED",
  },
}));

const { diligenceWorkflow } = await import(
  "@/lib/diligence/diligence-workflow"
);

describe("diligenceWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches workflow run ID to the job", async () => {
    mockRunNextStage.mockResolvedValueOnce({ status: "completed" });

    await diligenceWorkflow({
      jobId: "job-1",
      userId: "user-1",
      priority: 1,
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: { workflowRunId: "wf-run-123" },
    });
  });

  it("returns completed when first stage returns completed", async () => {
    mockRunNextStage.mockResolvedValueOnce({ status: "completed" });

    const result = await diligenceWorkflow({
      jobId: "job-1",
      userId: "user-1",
      priority: 1,
    });

    expect(result).toEqual({
      jobId: "job-1",
      completed: true,
      stagesRun: 1,
    });
  });

  it("returns waiting_input when stage returns waiting_input", async () => {
    mockRunNextStage.mockResolvedValueOnce({ status: "waiting_input" });

    const result = await diligenceWorkflow({
      jobId: "job-1",
      userId: "user-1",
      priority: 1,
    });

    expect(result).toEqual({
      jobId: "job-1",
      completed: false,
      stagesRun: 1,
    });
  });

  it("loops through multiple stages until completed", async () => {
    mockRunNextStage
      .mockResolvedValueOnce({ status: "progressed", stage: "DOCUMENT_EXTRACTION" })
      .mockResolvedValueOnce({ status: "progressed", stage: "DOCUMENT_CLASSIFICATION" })
      .mockResolvedValueOnce({ status: "completed" });

    const result = await diligenceWorkflow({
      jobId: "job-1",
      userId: "user-1",
      priority: 1,
    });

    expect(result).toEqual({
      jobId: "job-1",
      completed: true,
      stagesRun: 3,
    });
    expect(mockRunNextStage).toHaveBeenCalledTimes(3);
  });

  it("throws FatalError when worker throws DiligenceFatalError", async () => {
    const { DiligenceFatalError } = await import("@/lib/diligence/errors");
    mockRunNextStage.mockRejectedValueOnce(
      new DiligenceFatalError("Diligence job not found.")
    );

    await expect(
      diligenceWorkflow({ jobId: "job-1", userId: "user-1", priority: 1 })
    ).rejects.toThrow("Diligence job not found.");
  });

  it("throws FatalError for missing API key", async () => {
    const { DiligenceFatalError } = await import("@/lib/diligence/errors");
    mockRunNextStage.mockRejectedValueOnce(
      new DiligenceFatalError("Selected API key is missing or disabled.")
    );

    await expect(
      diligenceWorkflow({ jobId: "job-1", userId: "user-1", priority: 1 })
    ).rejects.toThrow("Selected API key is missing or disabled.");
  });

  it("re-throws non-fatal errors as-is", async () => {
    mockRunNextStage.mockRejectedValueOnce(
      new Error("Network timeout")
    );

    await expect(
      diligenceWorkflow({ jobId: "job-1", userId: "user-1", priority: 1 })
    ).rejects.toThrow("Network timeout");

    expect(mockStageRunUpdateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: "RUNNING" },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: "Network timeout",
        completedAt: expect.any(Date),
      }),
    });
    expect(mockUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: "job-1",
        userId: "user-1",
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: "Network timeout",
        completedAt: expect.any(Date),
        lastHeartbeatAt: expect.any(Date),
      }),
    });
  });

  it("treats stage-enum mismatch as fatal", async () => {
    mockRunNextStage.mockRejectedValueOnce(
      new Error(
        'Invalid `prisma.diligenceStageRun.upsert()` invocation: invalid input value for enum "DiligenceStageName": "RISK_EXTRACTION"'
      )
    );

    await expect(
      diligenceWorkflow({ jobId: "job-1", userId: "user-1", priority: 1 })
    ).rejects.toThrow('invalid input value for enum "DiligenceStageName"');
  });
});
