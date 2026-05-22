import { beforeEach, describe, expect, it, vi } from "vitest";

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
  buildProjectBlobPrefix: (userId: string, projectId: string) =>
    `users/${userId}/projects/${projectId}/`,
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
});

describe("retryProjectDueDiligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-starts the workflow for an existing job", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindDiligenceJobByIdForUser.mockResolvedValue({
      projectId: "project-1",
      priority: 2,
    });
    mockStart.mockResolvedValue({ runId: "run-2" });

    const result = await retryProjectDueDiligence("job-1");

    expect(result).toEqual({ runId: "run-2" });
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), [
      { jobId: "job-1", userId: "user-1", priority: 2 },
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/project/project-1");
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
