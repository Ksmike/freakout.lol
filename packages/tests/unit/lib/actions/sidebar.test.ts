import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockFindByIdForUser = vi.fn();
vi.mock("@/lib/models/ProjectModel", () => ({
  ProjectModel: {
    findByIdForUser: mockFindByIdForUser,
  },
}));

const mockFindFirstJob = vi.fn();
const mockFindFirstArtifact = vi.fn();
const mockFindUniqueGoal = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    diligenceJob: {
      findFirst: mockFindFirstJob,
    },
    diligenceArtifact: {
      findFirst: mockFindFirstArtifact,
    },
    assistanceGoal: {
      findUnique: mockFindUniqueGoal,
    },
  },
}));

const { getProjectForSidebar } = await import("@/lib/actions/sidebar");

describe("getProjectForSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getProjectForSidebar("project-1");

    expect(result).toBeNull();
    expect(mockFindByIdForUser).not.toHaveBeenCalled();
    expect(mockFindFirstJob).not.toHaveBeenCalled();
    expect(mockFindFirstArtifact).not.toHaveBeenCalled();
  });

  it("returns null when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const result = await getProjectForSidebar("project-1");

    expect(result).toBeNull();
  });

  it("returns null when project is not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindByIdForUser.mockResolvedValue(null);

    const result = await getProjectForSidebar("project-1");

    expect(result).toBeNull();
    expect(mockFindByIdForUser).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
    });
  });

  it("returns id and name when project is found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirstJob.mockResolvedValue({ id: "job-1" });
    mockFindFirstArtifact.mockResolvedValue({ id: "artifact-1" });
    mockFindUniqueGoal.mockResolvedValue({ projectId: "project-1" });
    mockFindByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Acme Corp",
      status: "draft",
      createdAt: new Date(),
    });

    const result = await getProjectForSidebar("project-1");

    expect(result).toEqual({
      id: "project-1",
      name: "Acme Corp",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
      hasDraft: true,
    });
  });

  it("returns false flags when no insights or reports exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirstJob.mockResolvedValue(null);
    mockFindFirstArtifact.mockResolvedValue(null);
    mockFindUniqueGoal.mockResolvedValue(null);
    mockFindByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Acme Corp",
      status: "draft",
      createdAt: new Date(),
    });

    const result = await getProjectForSidebar("project-1");

    expect(result).toEqual({
      id: "project-1",
      name: "Acme Corp",
      hasInsights: false,
      hasReports: false,
      hasEnquiries: false,
      hasDraft: false,
    });
  });
});
