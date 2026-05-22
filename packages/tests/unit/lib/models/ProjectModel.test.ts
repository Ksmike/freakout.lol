import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "../../../mocks/db";

vi.mock("@/lib/generated/prisma/client", () => ({
  ProjectStatus: {
    DRAFT: "DRAFT",
    IN_PROGRESS: "IN_PROGRESS",
    REVIEWED: "REVIEWED",
    COMPLETE: "COMPLETE",
    REJECTED: "REJECTED",
  },
}));

const mockEnsureDefaultForUser = vi.fn();
vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    ensureDefaultForUser: mockEnsureDefaultForUser,
  },
}));

const { ProjectModel } = await import("@/lib/models/ProjectModel");

describe("ProjectModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDefaultForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "OWNER",
    });
  });

  describe("countByUserId", () => {
    it("returns the count from db.project.count", async () => {
      mockDb.project.count.mockResolvedValue(5);

      const result = await ProjectModel.countByUserId("user-1");

      expect(result).toBe(5);
      expect(mockEnsureDefaultForUser).toHaveBeenCalledWith("user-1");
      expect(mockDb.project.count).toHaveBeenCalledWith({
        where: { firmId: "firm-1" },
      });
    });

    it("returns 0 when user has no projects", async () => {
      mockDb.project.count.mockResolvedValue(0);

      const result = await ProjectModel.countByUserId("user-2");

      expect(result).toBe(0);
    });
  });

  describe("listByUserId", () => {
    it("returns projects with normalized status", async () => {
      mockDb.project.findMany.mockResolvedValue([
        { id: "p1", name: "Project A", status: "DRAFT" },
        { id: "p2", name: "Project B", status: "IN_PROGRESS" },
      ]);

      const result = await ProjectModel.listByUserId("user-1");

      expect(result).toEqual([
        { id: "p1", name: "Project A", status: "draft" },
        { id: "p2", name: "Project B", status: "inprogress" },
      ]);
      expect(mockDb.project.findMany).toHaveBeenCalledWith({
        where: {
          firmId: "firm-1",
          OR: [
            { projectMemberships: { none: {} } },
            { projectMemberships: { some: { userId: "user-1" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true },
      });
    });

    it("defaults unknown status to draft", async () => {
      mockDb.project.findMany.mockResolvedValue([
        { id: "p1", name: "Project A", status: "unknown_status" },
      ]);

      const result = await ProjectModel.listByUserId("user-1");

      expect(result[0].status).toBe("draft");
    });

    it("returns empty array when user has no projects", async () => {
      mockDb.project.findMany.mockResolvedValue([]);

      const result = await ProjectModel.listByUserId("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("findByIdForUser", () => {
    it("returns project with normalized status when found", async () => {
      const createdAt = new Date("2024-01-01");
      mockDb.project.findFirst.mockResolvedValue({
        id: "p1",
        name: "Project A",
        status: "COMPLETE",
        createdAt,
        firmId: "firm-1",
      });

      const result = await ProjectModel.findByIdForUser({
        projectId: "p1",
        userId: "user-1",
      });

      expect(result).toEqual({
        id: "p1",
        name: "Project A",
        status: "complete",
        createdAt,
        firmId: "firm-1",
      });
      expect(mockDb.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: "p1",
          firmId: "firm-1",
          OR: [
            { projectMemberships: { none: {} } },
            { projectMemberships: { some: { userId: "user-1" } } },
          ],
        },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          firmId: true,
        },
      });
    });

    it("returns null when project is not found", async () => {
      mockDb.project.findFirst.mockResolvedValue(null);

      const result = await ProjectModel.findByIdForUser({
        projectId: "missing",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });

    it("defaults unknown status to draft", async () => {
      mockDb.project.findFirst.mockResolvedValue({
        id: "p1",
        name: "Project A",
        status: "invalid",
        createdAt: new Date(),
        firmId: "firm-1",
      });

      const result = await ProjectModel.findByIdForUser({
        projectId: "p1",
        userId: "user-1",
      });

      expect(result?.status).toBe("draft");
    });
  });

  describe("createForUser", () => {
    it("creates projects inside the user's active firm", async () => {
      mockDb.project.create.mockResolvedValue({ id: "p1" });

      await ProjectModel.createForUser({ name: "Project A", userId: "user-1" });

      expect(mockDb.project.create).toHaveBeenCalledWith({
        data: {
          name: "Project A",
          status: "DRAFT",
          userId: "user-1",
          firmId: "firm-1",
        },
      });
    });
  });

  describe("updateStatusForUser", () => {
    it("updates project status inside the user's active firm", async () => {
      mockDb.project.updateMany.mockResolvedValue({ count: 1 });

      const result = await ProjectModel.updateStatusForUser({
        projectId: "p1",
        userId: "user-1",
        status: "inprogress",
      });

      expect(result).toBe(true);
      expect(mockDb.project.updateMany).toHaveBeenCalledWith({
        where: { id: "p1", firmId: "firm-1" },
        data: { status: "IN_PROGRESS" },
      });
    });
  });

  describe("deleteForUser", () => {
    it("deletes projects inside the user's active firm", async () => {
      mockDb.project.deleteMany.mockResolvedValue({ count: 1 });

      const result = await ProjectModel.deleteForUser({
        projectId: "p1",
        userId: "user-1",
      });

      expect(result).toBe(true);
      expect(mockDb.project.deleteMany).toHaveBeenCalledWith({
        where: { id: "p1", firmId: "firm-1" },
      });
    });
  });
});
