import { db } from "@/lib/db";
import { ProjectStatus as PrismaProjectStatus } from "@/lib/generated/prisma/client";
import { FirmModel } from "@/lib/models/FirmModel";

/**
 * App-level project status (used in UI, labels, routing).
 * Maps 1:1 to the Prisma ProjectStatus enum.
 */
export type ProjectStatus =
  | "draft"
  | "inprogress"
  | "reviewed"
  | "complete"
  | "rejected";

const PRISMA_TO_APP: Record<PrismaProjectStatus, ProjectStatus> = {
  [PrismaProjectStatus.DRAFT]: "draft",
  [PrismaProjectStatus.IN_PROGRESS]: "inprogress",
  [PrismaProjectStatus.REVIEWED]: "reviewed",
  [PrismaProjectStatus.COMPLETE]: "complete",
  [PrismaProjectStatus.REJECTED]: "rejected",
};

const APP_TO_PRISMA: Record<ProjectStatus, PrismaProjectStatus> = {
  draft: PrismaProjectStatus.DRAFT,
  inprogress: PrismaProjectStatus.IN_PROGRESS,
  reviewed: PrismaProjectStatus.REVIEWED,
  complete: PrismaProjectStatus.COMPLETE,
  rejected: PrismaProjectStatus.REJECTED,
};

function toAppStatus(prismaStatus: PrismaProjectStatus): ProjectStatus {
  return PRISMA_TO_APP[prismaStatus] ?? "draft";
}

function toPrismaStatus(appStatus: ProjectStatus): PrismaProjectStatus {
  return APP_TO_PRISMA[appStatus] ?? PrismaProjectStatus.DRAFT;
}

export const ProjectModel = {
  async countByUserId(userId: string): Promise<number> {
    const firm = await FirmModel.ensureDefaultForUser(userId);

    return db.project.count({
      where: { firmId: firm.firmId },
    });
  },

  async listByUserId(
    userId: string
  ): Promise<Array<{ id: string; name: string; status: ProjectStatus }>> {
    const firm = await FirmModel.ensureDefaultForUser(userId);

    const projects = await db.project.findMany({
      where: {
        firmId: firm.firmId,
        // Include projects that are either:
        // - open (no project memberships at all), OR
        // - ring-fenced but the user has explicit access
        OR: [
          { projectMemberships: { none: {} } },
          { projectMemberships: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    return projects.map((project) => ({
      ...project,
      status: toAppStatus(project.status),
    }));
  },

  async findByIdForUser(input: {
    projectId: string;
    userId: string;
  }): Promise<{
    id: string;
    name: string;
    status: ProjectStatus;
    createdAt: Date;
    firmId: string;
  } | null> {
    const firm = await FirmModel.ensureDefaultForUser(input.userId);

    const project = await db.project.findFirst({
      where: {
        id: input.projectId,
        firmId: firm.firmId,
        // Enforce project-level membership: open projects OR user has explicit access
        OR: [
          { projectMemberships: { none: {} } },
          { projectMemberships: { some: { userId: input.userId } } },
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

    if (!project) {
      return null;
    }

    return {
      ...project,
      status: toAppStatus(project.status),
    };
  },

  async createForUser(input: { name: string; userId: string }) {
    const firm = await FirmModel.ensureDefaultForUser(input.userId);

    return db.project.create({
      data: {
        name: input.name,
        status: PrismaProjectStatus.DRAFT,
        userId: input.userId,
        firmId: firm.firmId,
      },
    });
  },

  async updateStatusForUser(input: {
    projectId: string;
    userId: string;
    status: ProjectStatus;
  }): Promise<boolean> {
    const firm = await FirmModel.ensureDefaultForUser(input.userId);

    const result = await db.project.updateMany({
      where: {
        id: input.projectId,
        firmId: firm.firmId,
      },
      data: {
        status: toPrismaStatus(input.status),
      },
    });

    return result.count > 0;
  },

  async deleteForUser(input: {
    projectId: string;
    userId: string;
  }): Promise<boolean> {
    const firm = await FirmModel.ensureDefaultForUser(input.userId);

    const result = await db.project.deleteMany({
      where: {
        id: input.projectId,
        firmId: firm.firmId,
      },
    });

    return result.count > 0;
  },

  // ── Project-level membership (ring-fencing) ───────────────────────────────

  async addMember(input: {
    projectId: string;
    userId: string;
    firmId: string;
    actorUserId: string;
  }): Promise<void> {
    await db.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: input.userId,
        },
      },
      create: {
        projectId: input.projectId,
        userId: input.userId,
        firmId: input.firmId,
      },
      update: {},
    });
  },

  async removeMember(input: {
    projectId: string;
    userId: string;
  }): Promise<void> {
    await db.projectMembership.deleteMany({
      where: {
        projectId: input.projectId,
        userId: input.userId,
      },
    });
  },

  async listMembers(projectId: string): Promise<
    Array<{ userId: string; name: string | null; email: string; createdAt: Date }>
  > {
    const memberships = await db.projectMembership.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      createdAt: m.createdAt,
    }));
  },

  async isRingFenced(projectId: string): Promise<boolean> {
    const count = await db.projectMembership.count({ where: { projectId } });
    return count > 0;
  },
};
