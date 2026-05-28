import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDocumentsPanel } from "@/app/(app)/project/[id]/ProjectDocumentsPanel";
import { toast } from "@heroui/react";
import {
  startProjectDueDiligence,
  retryProjectDueDiligence,
} from "@/lib/actions/project";

vi.mock("@heroui/react", async () => {
  const actual = await vi.importActual<typeof import("@heroui/react")>(
    "@heroui/react"
  );
  return {
    ...actual,
    toast: {
      warning: vi.fn(),
      success: vi.fn(),
      danger: vi.fn(),
    },
  };
});
vi.mock("@/lib/actions/project", () => ({
  startProjectDueDiligence: vi.fn().mockResolvedValue({ jobId: "job-1" }),
  retryProjectDueDiligence: vi.fn().mockResolvedValue({ runId: "run-1" }),
}));

const labels = {
  documentsHeading: "Files",
  fileInputLabel: "Upload files",
  uploadInProgress: "Uploading...",
  dropzoneTitle: "Drag and drop files to upload",
  dropzoneHint: "Files upload automatically after drop.",
  uploadQueueHeading: "Upload progress",
  uploadStatusQueued: "Queued",
  uploadStatusUploading: "Uploading",
  uploadStatusUploaded: "Uploaded",
  uploadStatusFailed: "Failed",
  clearUploadCta: "Clear",
  emptyDocuments: "No files uploaded yet.",
  loadingDocuments: "Loading files...",
  loadError: "Failed to load files.",
  uploadError: "Failed to upload file.",
  viewFileCta: "View",
  deleteFileCta: "Delete",
  deleteInProgress: "Deleting...",
  deleteError: "Failed to delete file.",
  reprocessFileCta: "Re-process",
  reprocessInProgress: "Queueing...",
  reprocessError: "Failed to queue file for re-processing.",
  fileStatusLabel: "File status",
  fileProcessingStatuses: {
    QUEUED: "Queued",
    PROCESSING: "Processing",
    PROCESSED: "Processed",
    FAILED: "Failed",
  },
  beDiligentCta: "Be Diligent",
  providerSelectionLabel: "Provider",
  modelInputLabel: "Model",
  modelInputPlaceholder: "gpt-4o-mini",
  fallbackProvidersLabel: "Fallback providers",
  retryDiligenceCta: "Retry diligence",
  cancelDiligenceCta: "Cancel diligence",
  cancelDiligenceConfirm: "Cancel the running diligence workflow?",
  cancelDiligenceToast: "Diligence cancelled.",
  cancelDiligenceErrorToast: "Failed to cancel diligence.",
  diligenceProgressHeading: "Diligence worker",
  diligenceStatusLabel: "Job status",
  diligenceCurrentStageLabel: "Current stage",
  diligenceJobIdLabel: "Job ID",
  diligenceTokenUsageLabel: "Token usage",
  diligenceCostEstimateLabel: "Estimated cost",
  diligenceLastErrorLabel: "Last error",
  diligenceNoJobMessage: "No diligence job has started yet.",
  diligenceFailedStageLabel: "Failed stage",
  diligenceAttemptsLabel: "Attempts",
  diligenceJobCreatedToast: "Due diligence job initialized.",
  diligenceRunningToast: "Diligence workflow running.",
  diligenceCompletedToast: "Due diligence job completed.",
  diligenceRetryToast: "Diligence retry started.",
  diligenceRetryErrorToast: "Failed to retry due diligence.",
  diligenceStatuses: {
    QUEUED: "Queued",
    RUNNING: "Running",
    WAITING_INPUT: "Waiting for Input",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELED: "Canceled",
  },
  diligenceStages: {
    DOCUMENT_EXTRACTION: "document extraction",
    DOCUMENT_CLASSIFICATION: "document classification",
    EVIDENCE_INDEXING: "evidence indexing",
    ENTITY_EXTRACTION: "entity extraction",
    CLAIM_EXTRACTION: "claim extraction",
    CORROBORATION: "corroboration",
    Q1_IDENTITY_AND_OWNERSHIP: "Q1: identity & ownership",
    Q2_PRODUCT_AND_TECHNOLOGY: "Q2: product & technology",
    Q3_MARKET_AND_TRACTION: "Q3: market & traction",
    Q4_EXECUTION_CAPABILITY: "Q4: execution capability",
    Q5_BUSINESS_MODEL_VIABILITY: "Q5: business model viability",
    Q6_RISK_ANALYSIS: "Q6: risk analysis",
    Q7_EVIDENCE_QUALITY: "Q7: evidence quality",
    Q8_FAILURE_MODES_AND_FRAGILITY: "Q8: failure modes & fragility",
    OPEN_QUESTIONS: "open questions",
    EXECUTIVE_SUMMARY: "executive summary",
    FINAL_REPORT: "final report",
  },
  setupApiKeysMessage: "Add at least one API key in Settings to run due diligence.",
  setupApiKeysToast: "No API keys found. Opening Settings in a new tab.",
  setupApiKeysNotification:
    "No API keys found. Add one in Settings to run due diligence.",
  setupApiKeysLinkCta: "Go to Settings",
  diligenceStartToast: "Due diligence started.",
  insightsHeading: "Reviewed insights",
  insightsEmpty: "No reviewed insights yet. Run due diligence to generate findings.",
  insightsRisksHeading: "Top risks",
  insightsClaimsHeading: "Key claims",
  insightsEntitiesHeading: "Core entities",
  insightsContradictionsHeading: "Contradictions",
  snapshotHistoryHeading: "Snapshot history",
  snapshotHistoryDescription: "Each completed diligence run locks its source files.",
  snapshotLabel: "Snapshot",
  currentSnapshotLabel: "Current snapshot",
  lockedSnapshotLabel: "Locked",
  editableSnapshotLabel: "Open",
  snapshotCompletedLabel: "Completed",
  snapshotFilesLabel: "Files",
  snapshotOverviewLabel: "Overview summary",
  snapshotNoNewFiles: "No new files uploaded for this snapshot yet.",
  activeSnapshotHint: "Upload the next set of files here.",
};

const apiKeyStatuses = [
  {
    id: "key-1",
    provider: "OPENAI",
    isSet: true,
    hint: "1234",
    connectorUrl: null,
    defaultModel: "gpt-4o-mini",
    enabled: true,
    lastValidatedAt: null,
  },
  {
    id: "key-2",
    provider: "ANTHROPIC",
    isSet: true,
    hint: "1234",
    connectorUrl: null,
    defaultModel: "claude-3-5-sonnet-latest",
    enabled: true,
    lastValidatedAt: null,
  },
] as const;

describe("ProjectDocumentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders existing documents", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/api/projects/project-1/documents/report.pdf"
    );
    expect(
      screen.queryByRole("button", { name: "Re-process" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Upload files")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload files")).toHaveAttribute(
      "accept",
      ".txt,.rtf,.docx,.pages,.pdf,.ppt,.pptx,.key,.keynote"
    );
  });

  it("clears failed uploads from the queue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Upload denied" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    await screen.findByText("No files uploaded yet.");
    await user.upload(
      screen.getByLabelText("Upload files"),
      new File(["file body"], "broken.pdf", { type: "application/pdf" })
    );

    expect(await screen.findByText("broken.pdf")).toBeInTheDocument();
    expect(await screen.findByText("Upload denied")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.queryByText("broken.pdf")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Upload denied")).not.toBeInTheDocument();
  });

  it("hides file upload controls while diligence is in progress", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="inprogress"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={{
          id: "job-1",
          status: "RUNNING",
          selectedProvider: "OPENAI",
          selectedModel: "gpt-4o-mini",
          currentStage: "DOCUMENT_EXTRACTION",
          progressPercent: 40,
          tokenUsageTotal: 100,
          estimatedCostUsd: 0.01,
          errorMessage: null,
          createdAt: new Date("2026-05-06T00:00:00.000Z"),
          completedAt: null,
          stageRuns: [],
        }}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Upload files")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Drag and drop files to upload")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Diligence worker")).toBeInTheDocument();
  });

  it("shows re-process action only for processed files", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "processed.pdf",
            pathname: "user-1/project-1/processed.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "PROCESSED",
            processingError: null,
            lastProcessedAt: "2026-05-06T00:00:00.000Z",
            reprocessCount: 0,
          },
          {
            id: "doc-2",
            filename: "queued.pdf",
            pathname: "user-1/project-1/queued.pdf",
            size: 1024,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    expect(await screen.findByText("processed.pdf")).toBeInTheDocument();
    expect(screen.getByText("queued.pdf")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Re-process" })).toHaveLength(1);
  });

  it("shows missing API key notification with a settings link", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={false}
        apiKeyStatuses={[]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Be Diligent" }));

    expect(
      await screen.findByText(
        "No API keys found. Add one in Settings to run due diligence."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Settings" })
    ).toHaveAttribute("href", "/settings/api-keys");
    expect(toast.warning).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("does not trigger diligence start when keys are missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={false}
        apiKeyStatuses={[]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Be Diligent" }));
    expect(startProjectDueDiligence).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith(
      "Due diligence job initialized."
    );
  });

  it("starts due diligence for draft projects with provider config", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "QUEUED",
            processingError: null,
            lastProcessedAt: null,
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="draft"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={null}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    fireEvent.change(await screen.findByLabelText("Model"), {
      target: { value: "gpt-4o" },
    });

    await user.click(await screen.findByRole("button", { name: "Be Diligent" }));

    expect(startProjectDueDiligence).toHaveBeenCalledWith("project-1", {
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o",
      fallbackProviders: [],
    });
    expect(toast.success).toHaveBeenCalledWith("Due diligence job initialized.");
  });

  it("retries a failed diligence job", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="inprogress"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={{
          id: "job-1",
          status: "FAILED",
          selectedProvider: "OPENAI",
          selectedModel: "gpt-4o-mini",
          currentStage: "DOCUMENT_CLASSIFICATION",
          progressPercent: 20,
          tokenUsageTotal: 100,
          estimatedCostUsd: 0.01,
          errorMessage: "boom",
          createdAt: new Date("2026-05-06T00:00:00.000Z"),
          completedAt: null,
          stageRuns: [
            {
              stage: "DOCUMENT_EXTRACTION",
              status: "COMPLETED",
              attempts: 1,
              errorMessage: null,
              updatedAt: new Date(),
            },
          ],
        }}
        diligenceSnapshots={[]}
        labels={labels}
      />
    );

    await user.click(
      await screen.findByRole("button", { name: "Retry diligence" })
    );

    expect(retryProjectDueDiligence).toHaveBeenCalledWith("job-1");
  });

  it("shows latest summary report without completed stage bars", async () => {
    const completedAt = new Date("2026-05-07T00:00:00.000Z");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "report.pdf",
            pathname: "user-1/project-1/report.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "PROCESSED",
            processingError: null,
            lastProcessedAt: "2026-05-06T00:00:00.000Z",
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="reviewed"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={{
          id: "job-1",
          status: "COMPLETED",
          selectedProvider: "OPENAI",
          selectedModel: "gpt-4o-mini",
          currentStage: "FINAL_REPORT",
          progressPercent: 100,
          tokenUsageTotal: 100,
          estimatedCostUsd: 0.01,
          errorMessage: null,
          createdAt: new Date("2026-05-06T00:00:00.000Z"),
          completedAt,
          stageRuns: [
            {
              stage: "DOCUMENT_EXTRACTION",
              status: "COMPLETED",
              attempts: 1,
              errorMessage: null,
              updatedAt: completedAt,
            },
          ],
        }}
        diligenceSnapshots={[
          {
            id: "job-1",
            status: "COMPLETED",
            createdAt: new Date("2026-05-06T00:00:00.000Z"),
            completedAt,
            progressPercent: 100,
            tokenUsageTotal: 100,
            estimatedCostUsd: 0.01,
            insights: {
              risks: [
                {
                  id: "risk-1",
                  title: "Risk A",
                  summary: "Risk summary",
                  confidence: 0.9,
                },
              ],
              claims: [],
              entities: [],
              contradictions: [],
            },
          },
        ]}
        labels={labels}
      />
    );

    expect(await screen.findByText("Reviewed insights")).toBeInTheDocument();
    expect(screen.getAllByText("Risk A").length).toBeGreaterThan(0);
    expect(screen.queryByText("Diligence worker")).not.toBeInTheDocument();
    expect(screen.queryByText("document extraction")).not.toBeInTheDocument();
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
  });

  it("renders the open upload snapshot before newest completed snapshots", async () => {
    const firstCompletedAt = new Date("2026-05-07T00:00:00.000Z");
    const secondCompletedAt = new Date("2026-05-09T00:00:00.000Z");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          {
            id: "doc-1",
            filename: "snapshot-one.pdf",
            pathname: "user-1/project-1/snapshot-one.pdf",
            size: 2048,
            uploadedAt: "2026-05-06T00:00:00.000Z",
            processingStatus: "PROCESSED",
            processingError: null,
            lastProcessedAt: "2026-05-06T00:00:00.000Z",
            reprocessCount: 0,
          },
          {
            id: "doc-2",
            filename: "snapshot-two.pdf",
            pathname: "user-1/project-1/snapshot-two.pdf",
            size: 2048,
            uploadedAt: "2026-05-08T00:00:00.000Z",
            processingStatus: "PROCESSED",
            processingError: null,
            lastProcessedAt: "2026-05-08T00:00:00.000Z",
            reprocessCount: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectDocumentsPanel
        projectId="project-1"
        projectStatus="reviewed"
        hasAnyApiKeys={true}
        apiKeyStatuses={[...apiKeyStatuses]}
        diligenceJob={null}
        diligenceSnapshots={[
          {
            id: "job-1",
            status: "COMPLETED",
            createdAt: new Date("2026-05-06T00:00:00.000Z"),
            completedAt: firstCompletedAt,
            progressPercent: 100,
            tokenUsageTotal: 100,
            estimatedCostUsd: 0.01,
            insights: { risks: [], claims: [], entities: [], contradictions: [] },
          },
          {
            id: "job-2",
            status: "COMPLETED",
            createdAt: new Date("2026-05-08T00:00:00.000Z"),
            completedAt: secondCompletedAt,
            progressPercent: 100,
            tokenUsageTotal: 200,
            estimatedCostUsd: 0.02,
            insights: { risks: [], claims: [], entities: [], contradictions: [] },
          },
        ]}
        labels={labels}
      />
    );

    expect(await screen.findByText("snapshot-one.pdf")).toBeInTheDocument();
    const headings = screen
      .getAllByRole("heading", { name: /Snapshot [123]/ })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Snapshot 3", "Snapshot 2", "Snapshot 1"]);
  });
});
