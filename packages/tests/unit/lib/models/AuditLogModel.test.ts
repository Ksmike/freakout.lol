import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockDb } from "../../../mocks/db";

vi.mock("@/lib/generated/prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/generated/prisma/client")>(
    "@/lib/generated/prisma/client"
  );
  return {
    ...actual,
    AuditAction: {
      FIRM_MEMBER_ADDED: "FIRM_MEMBER_ADDED",
      FIRM_MEMBER_ROLE_UPDATED: "FIRM_MEMBER_ROLE_UPDATED",
    },
    Prisma: {
      JsonNull: "JsonNull",
    },
  };
});

const { AuditLogModel } = await import("@/lib/models/AuditLogModel");

describe("AuditLogModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records audit events", async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await AuditLogModel.record({
      firmId: "firm-1",
      actorUserId: "user-1",
      action: "FIRM_MEMBER_ADDED" as never,
      targetType: "FirmMembership",
      targetId: "member-1",
      metadata: { role: "ANALYST" },
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        firmId: "firm-1",
        actorUserId: "user-1",
        action: "FIRM_MEMBER_ADDED",
        targetType: "FirmMembership",
        targetId: "member-1",
        projectId: null,
        metadata: { role: "ANALYST" },
        requestId: null,
      },
    });
  });

  it("lists recent audit events for a firm", async () => {
    mockDb.auditLog.findMany.mockResolvedValue([]);

    await AuditLogModel.listForFirm({ firmId: "firm-1", take: 5 });

    expect(mockDb.auditLog.findMany).toHaveBeenCalledWith({
      where: { firmId: "firm-1" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });
});
