import { db } from "@/lib/db";
import { AuditAction, Prisma } from "@/lib/generated/prisma/client";

export type AuditLogListItem = {
  id: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    email: string;
  };
};

export const AuditLogModel = {
  async record(input: {
    firmId: string;
    actorUserId: string;
    action: AuditAction;
    targetType: string;
    targetId: string;
    projectId?: string | null;
    metadata?: Prisma.InputJsonValue;
    requestId?: string | null;
  }) {
    return db.auditLog.create({
      data: {
        firmId: input.firmId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        projectId: input.projectId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        requestId: input.requestId ?? null,
      },
    });
  },

  async listForFirm(input: {
    firmId: string;
    take?: number;
  }): Promise<AuditLogListItem[]> {
    return db.auditLog.findMany({
      where: {
        firmId: input.firmId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.take ?? 20,
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
  },
};
