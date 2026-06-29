import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalWorkflowLocalBaseUrl = process.env.WORKFLOW_LOCAL_BASE_URL;
const originalNodeExtraCaCerts = process.env.NODE_EXTRA_CA_CERTS;
const originalFetch = globalThis.fetch;
const localWorkflowFetchPatchKey = "__ddQualifyLocalWorkflowFetchPatch";

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
  delete (globalThis as typeof globalThis & Record<string, unknown>)[
    localWorkflowFetchPatchKey
  ];
  if (originalWorkflowLocalBaseUrl === undefined) {
    delete process.env.WORKFLOW_LOCAL_BASE_URL;
  } else {
    process.env.WORKFLOW_LOCAL_BASE_URL = originalWorkflowLocalBaseUrl;
  }
  if (originalNodeExtraCaCerts === undefined) {
    delete process.env.NODE_EXTRA_CA_CERTS;
  } else {
    process.env.NODE_EXTRA_CA_CERTS = originalNodeExtraCaCerts;
  }
});

const mockHttpRequest = vi.fn();
const mockHttpsRequest = vi.fn();
vi.mock("node:http", () => ({
  default: { request: mockHttpRequest },
  request: mockHttpRequest,
}));
vi.mock("node:https", () => ({
  default: { request: mockHttpsRequest },
  request: mockHttpsRequest,
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockProjectModel = {
  countByUserId: vi.fn(),
  createForUser: vi.fn(),
  updateStatusForUser: vi.fn(),
  findByIdForUser: vi.fn(),
  deleteForUser: vi.fn(),
};
vi.mock("@/lib/models/ProjectModel", () => ({
  ProjectModel: mockProjectModel,
}));

const mockListEnabledForUser = vi.fn();
vi.mock("@/lib/models/UserApiKeyModel", () => ({
  UserApiKeyModel: {
    listEnabledForUser: mockListEnabledForUser,
  },
}));

const mockRoute = vi.fn();
vi.mock("@/lib/diligence/model-router", () => ({
  ModelRouter: class {
    route = mockRoute;
  },
}));

const mockFindLatestForProject = vi.fn();
const mockCreateDiligenceJob = vi.fn();
const mockFindDiligenceJobByIdForUser = vi.fn();
vi.mock("@/lib/models/DiligenceJobModel", () => ({
  DiligenceJobModel: {
    findLatestForProject: mockFindLatestForProject,
    create: mockCreateDiligenceJob,
    findByIdForUser: mockFindDiligenceJobByIdForUser,
  },
}));

const mockStart = vi.fn();
const mockGetRun = vi.fn();
vi.mock("workflow/api", () => ({
  start: mockStart,
  getRun: mockGetRun,
}));

vi.mock("@/lib/diligence/diligence-workflow", () => ({
  diligenceWorkflow: vi.fn(),
}));

const mockDbDiligenceJobFindFirst = vi.fn();
const mockDbDiligenceJobFindMany = vi.fn();
const mockDbDiligenceJobUpdateMany = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    diligenceJob: {
      findFirst: mockDbDiligenceJobFindFirst,
      findMany: mockDbDiligenceJobFindMany,
      updateMany: mockDbDiligenceJobUpdateMany,
    },
  },
}));

vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    ensureDefaultForUser: vi.fn().mockResolvedValue({ firmId: "firm-1", role: "OWNER" }),
  },
}));

vi.mock("@/lib/models/BillingModel", () => ({
  BillingModel: {
    checkProjectCreation: vi.fn().mockResolvedValue({ allowed: true }),
    checkWorkflowRun: vi.fn().mockResolvedValue({ allowed: true }),
    incrementRuns: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockBlobList = vi.fn();
const mockBlobDel = vi.fn();
vi.mock("@vercel/blob", () => ({
  list: mockBlobList,
  del: mockBlobDel,
}));

vi.mock("@/lib/blob/documents", () => ({
  buildProjectBlobPrefix: (firmId: string, projectId: string) =>
    `${firmId}/${projectId}/`,
}));

const mockCountForProject = vi.fn();
const mockMarkAllQueuedForProject = vi.fn();
vi.mock("@/lib/models/ProjectDocumentModel", () => ({
  ProjectDocumentModel: {
    countForProject: mockCountForProject,
    markAllQueuedForProject: mockMarkAllQueuedForProject,
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>(
    "next/navigation"
  );
  return {
    ...actual,
    redirect: mockRedirect,
  };
});

function createMockLocalWorkflowRequest(
  onEnd: (handlers: Map<string, (value?: unknown) => void>) => void
) {
  const handlers = new Map<string, (value?: unknown) => void>();
  const request = {
    on: vi.fn((event: string, handler: (value?: unknown) => void) => {
      handlers.set(event, handler);
      return request;
    }),
    end: vi.fn(() => onEnd(handlers)),
    destroy: vi.fn((error?: unknown) => {
      handlers.get("error")?.(error);
      return request;
    }),
  };

  return request;
}

function mockLocalWorkflowRequestOk(requestMock: ReturnType<typeof vi.fn>) {
  requestMock.mockImplementation((_url, _options, callback) =>
    createMockLocalWorkflowRequest(() => {
      const response = {
        statusCode: 200,
        resume: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === "end") {
            handler();
          }
          return response;
        }),
      };

      callback(response);
    })
  );
}

function mockLocalWorkflowRequestError(
  requestMock: ReturnType<typeof vi.fn>,
  code: string,
  message: string
) {
  requestMock.mockImplementation(() =>
    createMockLocalWorkflowRequest((handlers) => {
      handlers.get("error")?.(Object.assign(new Error(message), { code }));
    })
  );
}

beforeEach(() => {
  mockLocalWorkflowRequestOk(mockHttpRequest);
  mockLocalWorkflowRequestOk(mockHttpsRequest);
});

const {
  createProject,
  startProjectDueDiligence,
  retryProjectDueDiligence,
  cancelProjectDueDiligence,
  deleteProject,
} = await import("@/lib/actions/project");

function buildFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value);
  }
  return formData;
}

describe("createProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      createProject(buildFormData({ name: "Project A" }))
    ).rejects.toThrow("REDIRECT:/login?callbackUrl=/projects/new");
  });

  it("redirects back to create page when name is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(createProject(buildFormData({ name: "   " }))).rejects.toThrow(
      "REDIRECT:/projects/new"
    );
    expect(mockProjectModel.createForUser).not.toHaveBeenCalled();
  });

  it("creates project and redirects to the project page", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.createForUser.mockResolvedValue({
      id: "project-1",
      name: "Project A",
      userId: "user-1",
    });

    await expect(
      createProject(buildFormData({ name: "  Project A  " }))
    ).rejects.toThrow("REDIRECT:/project/project-1");

    expect(mockProjectModel.createForUser).toHaveBeenCalledWith({
      name: "Project A",
      userId: "user-1",
    });
  });
});

describe("startProjectDueDiligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await startProjectDueDiligence("project-1");
    expect(result).toEqual({ error: "Not authenticated." });
  });

  it("returns error when project is not found for user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(false);

    const result = await startProjectDueDiligence("project-1");
    expect(result).toEqual({ error: "Project not found." });
  });

  it("creates a diligence job and starts the workflow", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockListEnabledForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        defaultModel: "gpt-4o-mini",
        enabled: true,
      },
    ]);
    mockRoute.mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
    mockFindLatestForProject.mockResolvedValue(null);
    mockCountForProject.mockResolvedValue(1);
    mockMarkAllQueuedForProject.mockResolvedValue({ count: 1 });
    mockCreateDiligenceJob.mockResolvedValue({ id: "job-1" });
    mockStart.mockResolvedValue({ runId: "run-1" });

    const result = await startProjectDueDiligence("project-1", { priority: 5 });

    expect(result).toEqual({ jobId: "job-1", runId: "run-1" });
    expect(mockCreateDiligenceJob).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 5 })
    );
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), [
      { jobId: "job-1", userId: "user-1", priority: 5 },
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("does not start a duplicate workflow for an active job", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockFindLatestForProject.mockResolvedValueOnce({
      id: "job-1",
      status: "RUNNING",
    });

    const result = await startProjectDueDiligence("project-1");

    expect(result).toEqual({ jobId: "job-1" });
    expect(mockListEnabledForUser).not.toHaveBeenCalled();
    expect(mockCreateDiligenceJob).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("reverts project status when no enabled provider keys exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockFindLatestForProject.mockResolvedValue(null);
    mockListEnabledForUser.mockResolvedValue([]);

    const result = await startProjectDueDiligence("project-1");

    expect(result).toEqual({
      error: "No enabled provider API keys are configured.",
    });
    expect(mockProjectModel.updateStatusForUser).toHaveBeenNthCalledWith(1, {
      projectId: "project-1",
      userId: "user-1",
      status: "inprogress",
    });
    expect(mockProjectModel.updateStatusForUser).toHaveBeenNthCalledWith(2, {
      projectId: "project-1",
      userId: "user-1",
      status: "draft",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("resets an existing failed job before starting the workflow", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockListEnabledForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        defaultModel: "gpt-4o-mini",
        enabled: true,
      },
    ]);
    mockRoute.mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
    mockFindLatestForProject.mockResolvedValue({
      id: "job-1",
      status: "FAILED",
    });
    mockStart.mockResolvedValue({ runId: "run-1" });

    const result = await startProjectDueDiligence("project-1");

    expect(result).toEqual({ jobId: "job-1", runId: "run-1" });
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: {
        status: "QUEUED",
        workflowRunId: null,
        errorMessage: null,
        completedAt: null,
        lastHeartbeatAt: null,
      },
    });
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), [
      { jobId: "job-1", userId: "user-1", priority: 0 },
    ]);
  });

  it("uses the mkcert CA for Workflow start's local HTTPS callback", async () => {
    process.env.WORKFLOW_LOCAL_BASE_URL = "https://localhost:3000";
    process.env.NODE_EXTRA_CA_CERTS = `${process.cwd()}/certificates/localhost.pem`;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockListEnabledForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        defaultModel: "gpt-4o-mini",
        enabled: true,
      },
    ]);
    mockRoute.mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
    mockFindLatestForProject.mockResolvedValue(null);
    mockCountForProject.mockResolvedValue(1);
    mockMarkAllQueuedForProject.mockResolvedValue({ count: 1 });
    mockCreateDiligenceJob.mockResolvedValue({ id: "job-1" });
    mockStart.mockImplementation(async () => {
      await fetch("https://localhost:3000/.well-known/workflow/v1/flow", {
        method: "POST",
        dispatcher: "workflow-default-dispatcher",
      } as RequestInit & { dispatcher: unknown });
      return { runId: "run-1" };
    });

    const result = await startProjectDueDiligence("project-1");

    expect(result).toEqual({ jobId: "job-1", runId: "run-1" });
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { dispatcher?: unknown },
    ];
    expect(init.dispatcher).toBeDefined();
    expect(init.dispatcher).not.toBe("workflow-default-dispatcher");
  });

  it("returns an actionable error when local workflow cannot verify the HTTPS certificate", async () => {
    process.env.WORKFLOW_LOCAL_BASE_URL = "https://localhost:3000";
    mockLocalWorkflowRequestError(
      mockHttpsRequest,
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "unable to verify certificate"
    );
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockListEnabledForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        defaultModel: "gpt-4o-mini",
        enabled: true,
      },
    ]);
    mockRoute.mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
    mockFindLatestForProject.mockResolvedValue(null);

    const result = await startProjectDueDiligence("project-1");

    expect(result.error).toContain("mkcert -install");
    expect(result.error).toContain("yarn dev:http");
    expect(mockCreateDiligenceJob).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockProjectModel.updateStatusForUser).toHaveBeenLastCalledWith({
      projectId: "project-1",
      userId: "user-1",
      status: "draft",
    });
  });

  it("marks the job failed and releases the project when workflow start fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockListEnabledForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        defaultModel: "gpt-4o-mini",
        enabled: true,
      },
    ]);
    mockRoute.mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
    mockFindLatestForProject.mockResolvedValue(null);
    mockCountForProject.mockResolvedValue(1);
    mockMarkAllQueuedForProject.mockResolvedValue({ count: 1 });
    mockCreateDiligenceJob.mockResolvedValue({ id: "job-1" });
    mockStart.mockRejectedValue(new Error("queue down"));

    const result = await startProjectDueDiligence("project-1");

    expect(result).toEqual({ error: "queue down", jobId: "job-1" });
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: "queue down",
        completedAt: expect.any(Date),
        lastHeartbeatAt: expect.any(Date),
      }),
    });
    expect(mockProjectModel.updateStatusForUser).toHaveBeenLastCalledWith({
      projectId: "project-1",
      userId: "user-1",
      status: "draft",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

describe("retryProjectDueDiligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-starts the workflow for an existing job", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockFindDiligenceJobByIdForUser.mockResolvedValue({
      projectId: "project-1",
      priority: 2,
    });
    mockStart.mockResolvedValue({ runId: "run-2" });

    const result = await retryProjectDueDiligence("job-1");

    expect(result).toEqual({ runId: "run-2" });
    expect(mockProjectModel.updateStatusForUser).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
      status: "inprogress",
    });
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: {
        status: "QUEUED",
        workflowRunId: null,
        errorMessage: null,
        completedAt: null,
        lastHeartbeatAt: null,
      },
    });
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), [
      { jobId: "job-1", userId: "user-1", priority: 2 },
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
  });

  it("marks the job failed and releases the project when retry start fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockFindDiligenceJobByIdForUser.mockResolvedValue({
      projectId: "project-1",
      priority: 2,
    });
    mockStart.mockRejectedValue(new Error("queue down"));

    const result = await retryProjectDueDiligence("job-1");

    expect(result).toEqual({ error: "queue down" });
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "job-1", userId: "user-1" },
      data: {
        status: "QUEUED",
        workflowRunId: null,
        errorMessage: null,
        completedAt: null,
        lastHeartbeatAt: null,
      },
    });
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "job-1", userId: "user-1" },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: "queue down",
        completedAt: expect.any(Date),
        lastHeartbeatAt: expect.any(Date),
      }),
    });
    expect(mockProjectModel.updateStatusForUser).toHaveBeenLastCalledWith({
      projectId: "project-1",
      userId: "user-1",
      status: "draft",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("returns an actionable error when local workflow uses HTTPS against HTTP on retry", async () => {
    process.env.WORKFLOW_LOCAL_BASE_URL = "https://localhost:3000";
    mockLocalWorkflowRequestError(
      mockHttpsRequest,
      "ERR_SSL_WRONG_VERSION_NUMBER",
      "wrong version number"
    );
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(true);
    mockFindDiligenceJobByIdForUser.mockResolvedValue({
      projectId: "project-1",
      priority: 2,
    });

    const result = await retryProjectDueDiligence("job-1");

    expect(result.error).toContain("yarn dev:http");
    expect(result.error).toContain("WORKFLOW_LOCAL_BASE_URL=http://localhost:3000");
    expect(mockDbDiligenceJobUpdateMany).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockProjectModel.updateStatusForUser).toHaveBeenLastCalledWith({
      projectId: "project-1",
      userId: "user-1",
      status: "draft",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("returns an error when the retry project cannot be updated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.updateStatusForUser.mockResolvedValue(false);
    mockFindDiligenceJobByIdForUser.mockResolvedValue({
      projectId: "project-1",
      priority: 2,
    });

    const result = await retryProjectDueDiligence("job-1");

    expect(result).toEqual({ error: "Project not found." });
    expect(mockDbDiligenceJobUpdateMany).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("returns an error when job is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindDiligenceJobByIdForUser.mockResolvedValue(null);

    const result = await retryProjectDueDiligence("missing");

    expect(result).toEqual({ error: "Diligence job not found." });
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe("cancelProjectDueDiligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels the workflow run and marks the job CANCELED", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbDiligenceJobFindFirst.mockResolvedValue({
      id: "job-1",
      projectId: "project-1",
      workflowRunId: "wrun_abc",
      status: "RUNNING",
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockGetRun.mockReturnValue({ cancel });

    const result = await cancelProjectDueDiligence("job-1");

    expect(result).toEqual({});
    expect(mockGetRun).toHaveBeenCalledWith("wrun_abc");
    expect(cancel).toHaveBeenCalled();
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: expect.objectContaining({ status: "CANCELED" }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
  });

  it("still marks job CANCELED if run cancel throws", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbDiligenceJobFindFirst.mockResolvedValue({
      id: "job-1",
      projectId: "project-1",
      workflowRunId: "wrun_abc",
      status: "RUNNING",
    });
    const cancel = vi.fn().mockRejectedValue(new Error("already terminal"));
    mockGetRun.mockReturnValue({ cancel });

    const result = await cancelProjectDueDiligence("job-1");

    expect(result).toEqual({});
    expect(mockDbDiligenceJobUpdateMany).toHaveBeenCalled();
  });

  it("returns an error when job is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbDiligenceJobFindFirst.mockResolvedValue(null);

    const result = await cancelProjectDueDiligence("missing");

    expect(result).toEqual({ error: "Diligence job not found." });
    expect(mockGetRun).not.toHaveBeenCalled();
    expect(mockDbDiligenceJobUpdateMany).not.toHaveBeenCalled();
  });
});

describe("deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels active runs, removes blobs, deletes the project", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Acme",
      status: "draft",
      createdAt: new Date(),
    });
    mockDbDiligenceJobFindMany.mockResolvedValue([
      { workflowRunId: "wrun_a" },
      { workflowRunId: "wrun_b" },
    ]);
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockGetRun.mockReturnValue({ cancel });
    mockBlobList.mockResolvedValue({
      blobs: [{ url: "https://blob/x" }, { url: "https://blob/y" }],
    });
    mockBlobDel.mockResolvedValue(undefined);
    mockProjectModel.deleteForUser.mockResolvedValue(true);

    const result = await deleteProject("project-1");

    expect(result).toEqual({});
    expect(mockGetRun).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(mockBlobDel).toHaveBeenCalledWith([
      "https://blob/x",
      "https://blob/y",
    ]);
    expect(mockProjectModel.deleteForUser).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("returns an error when project is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue(null);

    const result = await deleteProject("missing");

    expect(result).toEqual({ error: "Project not found." });
    expect(mockProjectModel.deleteForUser).not.toHaveBeenCalled();
  });

  it("proceeds with delete even if blob list fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Acme",
      status: "draft",
      createdAt: new Date(),
    });
    mockDbDiligenceJobFindMany.mockResolvedValue([]);
    mockBlobList.mockRejectedValue(new Error("blob unavailable"));
    mockProjectModel.deleteForUser.mockResolvedValue(true);

    const result = await deleteProject("project-1");

    expect(result).toEqual({});
    expect(mockProjectModel.deleteForUser).toHaveBeenCalled();
  });
});
