import { db } from "@/lib/db";
import {
  FirmMembershipStatus,
  FirmRole,
} from "@/lib/generated/prisma/client";

export type ActiveFirmContext = {
  firmId: string;
  role: FirmRole;
};

export type ActiveFirmSummary = ActiveFirmContext & {
  name: string;
  slug: string;
  plan: string;
  billingStatus: string;
};

export type FirmMemberListItem = {
  id: string;
  role: FirmRole;
  status: FirmMembershipStatus;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

function defaultFirmSlug(userId: string): string {
  return `default-${userId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

export const FirmModel = {
  async getActiveFirmForUser(userId: string): Promise<ActiveFirmContext | null> {
    const membership = await db.firmMembership.findFirst({
      where: {
        userId,
        status: FirmMembershipStatus.ACTIVE,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        firmId: true,
        role: true,
      },
    });

    return membership;
  },

  async ensureDefaultForUser(userId: string): Promise<ActiveFirmContext> {
    const existing = await this.getActiveFirmForUser(userId);
    if (existing) {
      return existing;
    }

    const firm = await db.firm.create({
      data: {
        name: "Default Firm",
        slug: defaultFirmSlug(userId),
        memberships: {
          create: {
            userId,
            role: FirmRole.OWNER,
            status: FirmMembershipStatus.ACTIVE,
            acceptedAt: new Date(),
          },
        },
      },
      select: {
        id: true,
      },
    });

    return {
      firmId: firm.id,
      role: FirmRole.OWNER,
    };
  },

  async getActiveFirmSummaryForUser(
    userId: string
  ): Promise<ActiveFirmSummary> {
    const firm = await this.ensureDefaultForUser(userId);
    const membership = await db.firmMembership.findFirst({
      where: {
        userId,
        firmId: firm.firmId,
        status: FirmMembershipStatus.ACTIVE,
      },
      select: {
        role: true,
        firm: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            billingStatus: true,
          },
        },
      },
    });

    if (!membership) {
      return {
        firmId: firm.firmId,
        role: firm.role,
        name: "Default Firm",
        slug: defaultFirmSlug(userId),
        plan: "starter",
        billingStatus: "trialing",
      };
    }

    return {
      firmId: membership.firm.id,
      role: membership.role,
      name: membership.firm.name,
      slug: membership.firm.slug,
      plan: membership.firm.plan,
      billingStatus: membership.firm.billingStatus,
    };
  },

  async listMembers(firmId: string): Promise<FirmMemberListItem[]> {
    return db.firmMembership.findMany({
      where: {
        firmId,
        status: FirmMembershipStatus.ACTIVE,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  },

  async addExistingUserByEmail(input: {
    firmId: string;
    email: string;
    role: FirmRole;
  }): Promise<{ added: true } | { added: false; reason: "USER_NOT_FOUND" }> {
    const user = await db.user.findUnique({
      where: {
        email: input.email,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return { added: false, reason: "USER_NOT_FOUND" };
    }

    await db.firmMembership.create({
      data: {
        firmId: input.firmId,
        userId: user.id,
        role: input.role,
        status: FirmMembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    });

    return { added: true };
  },

  async updateMemberRole(input: {
    firmId: string;
    membershipId: string;
    role: FirmRole;
  }): Promise<boolean> {
    const result = await db.firmMembership.updateMany({
      where: {
        id: input.membershipId,
        firmId: input.firmId,
        status: FirmMembershipStatus.ACTIVE,
      },
      data: {
        role: input.role,
      },
    });

    return result.count > 0;
  },
};
