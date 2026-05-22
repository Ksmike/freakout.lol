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

const mockFirmModel = {
  ensureDefaultForUser: vi.fn().mockResolvedValue({ firmId: "firm-1", role: "OWNER" }),
  getActiveFirmForUser: vi.fn(),
};
vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: mockFirmModel,
}));

const mockBillingModel = {
  checkProjectCreation: vi.fn().mockResolvedValue({ allowed: true }),
  checkWorkflowRun: vi.fn().mockResolvedValue({ allowed: true }),
  incrementRuns: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@/lib/models/BillingModel", () => ({
  BillingModel: mockBillingModel,
}));

const mockAuditRecord = vi.fn();
vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: {
    record: mockAuditRecord,
  },
}));

const mockListEnabledForUser = vi.fn();
vi.mock("@/lib/models/UserApiKeyModel", () => ({
  UserApiKeyModel: {
    listEnabledForUser: mockListEnabledForUser,
  },
}));

vi.mock("@/lib/diligence/model-router", () => ({
  ModelRouter: class {
    route = vi.fn().mockReturnValue({
      userApiKeyId: "key-1",
      selectedProvider: "OPENAI",
      selectedModel: "gpt-4o-mini",
      fallbackProviders: [],
    });
  },
}));

vi.mock("@/lib/models/DiligenceJobModel", () => ({
  DiligenceJobModel: {
    findLatestForProject: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "job-1" }),
    findByIdForUser: vi.fn(),
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

vi.mock("@/lib/db", () => ({
  db: {
    diligenceJob: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
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

vi.mock("@/lib/models/ProjectDocumentModel", () => ({
  ProjectDocumentModel: {
    countForProject: vi.fn().mockResolvedValue(2),
    markAllQueuedForProject: vi.fn().mockResolvedValue({ count: 2 }),
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

const { createProject, deleteProject } = await import(
  "@/lib/actions/project"
);

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

  it("redirects to login when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      createProject(buildFormData({ name: "Test" }))
    ).rejects.toThrow("REDIRECT:/login?callbackUrl=/projects/new");
  });

  it("redirects to /projects/new when name is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(
      createProject(buildFormData({ name: "" }))
    ).rejects.toThrow("REDIRECT:/projects/new");
    expect(mockProjectModel.createForUser).not.toHaveBeenCalled();
  });

  it("redirects to /projects/new when name is whitespace only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    await expect(
      createProject(buildFormData({ name: "   " }))
    ).rejects.toThrow("REDIRECT:/projects/new");
  });

  it("trims and truncates name to 120 chars", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.createForUser.mockResolvedValue({ id: "p1" });

    const longName = "A".repeat(200);
    await expect(
      createProject(buildFormData({ name: longName }))
    ).rejects.toThrow("REDIRECT:/project/p1");

    const calledWith = mockProjectModel.createForUser.mock.calls[0][0];
    expect(calledWith.name).toHaveLength(120);
  });

  it("creates project and redirects to project page on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.createForUser.mockResolvedValue({ id: "project-new" });

    await expect(
      createProject(buildFormData({ name: "My Project" }))
    ).rejects.toThrow("REDIRECT:/project/project-new");

    expect(mockProjectModel.createForUser).toHaveBeenCalledWith({
      name: "My Project",
      userId: "user-1",
    });
  });
});

describe("deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteProject("project-1");

    expect(result).toEqual({ error: "Not authenticated." });
  });

  it("returns error when project is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue(null);

    const result = await deleteProject("missing");

    expect(result).toEqual({ error: "Project not found." });
  });

  it("deletes project and revalidates paths on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Test",
      status: "draft",
      createdAt: new Date(),
    });
    mockBlobList.mockResolvedValue({ blobs: [] });
    mockProjectModel.deleteForUser.mockResolvedValue(true);

    const result = await deleteProject("project-1");

    expect(result).toEqual({});
    expect(mockProjectModel.deleteForUser).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("proceeds even when blob deletion fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockProjectModel.findByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Test",
      status: "draft",
      createdAt: new Date(),
    });
    mockBlobList.mockRejectedValue(new Error("blob error"));
    mockProjectModel.deleteForUser.mockResolvedValue(true);

    const result = await deleteProject("project-1");

    expect(result).toEqual({});
    expect(mockProjectModel.deleteForUser).toHaveBeenCalled();
  });
});
