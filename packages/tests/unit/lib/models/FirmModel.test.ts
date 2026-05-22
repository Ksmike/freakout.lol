import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "../../../mocks/db";

vi.mock("@/lib/generated/prisma/client", () => ({
  FirmMembershipStatus: {
    ACTIVE: "ACTIVE",
  },
  FirmRole: {
    OWNER: "OWNER",
    ANALYST: "ANALYST",
    REVIEWER: "REVIEWER",
  },
}));

const { FirmModel } = await import("@/lib/models/FirmModel");

describe("FirmModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActiveFirmForUser", () => {
    it("returns the first active membership", async () => {
      mockDb.firmMembership.findFirst.mockResolvedValue({
        firmId: "firm-1",
        role: "OWNER",
      });

      const result = await FirmModel.getActiveFirmForUser("user-1");

      expect(result).toEqual({ firmId: "firm-1", role: "OWNER" });
      expect(mockDb.firmMembership.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { firmId: true, role: true },
      });
    });
  });

  describe("ensureDefaultForUser", () => {
    it("returns an existing active firm when one exists", async () => {
      mockDb.firmMembership.findFirst.mockResolvedValue({
        firmId: "firm-1",
        role: "ADMIN",
      });

      const result = await FirmModel.ensureDefaultForUser("user-1");

      expect(result).toEqual({ firmId: "firm-1", role: "ADMIN" });
      expect(mockDb.firm.create).not.toHaveBeenCalled();
    });

    it("creates a default firm and owner membership when none exists", async () => {
      mockDb.firmMembership.findFirst.mockResolvedValue(null);
      mockDb.firm.create.mockResolvedValue({ id: "firm-created" });

      const result = await FirmModel.ensureDefaultForUser("User_1");

      expect(result).toEqual({ firmId: "firm-created", role: "OWNER" });
      expect(mockDb.firm.create).toHaveBeenCalledWith({
        data: {
          name: "Default Firm",
          slug: "default-user-1",
          memberships: {
            create: expect.objectContaining({
              userId: "User_1",
              role: "OWNER",
              status: "ACTIVE",
            }),
          },
        },
        select: { id: true },
      });
    });
  });

  describe("getActiveFirmSummaryForUser", () => {
    it("returns active firm details", async () => {
      mockDb.firmMembership.findFirst
        .mockResolvedValueOnce({ firmId: "firm-1", role: "ADMIN" })
        .mockResolvedValueOnce({
          role: "ADMIN",
          firm: {
            id: "firm-1",
            name: "Acme",
            slug: "acme",
            plan: "starter",
            billingStatus: "trialing",
          },
        });

      const result = await FirmModel.getActiveFirmSummaryForUser("user-1");

      expect(result).toEqual({
        firmId: "firm-1",
        role: "ADMIN",
        name: "Acme",
        slug: "acme",
        plan: "starter",
        billingStatus: "trialing",
      });
      expect(mockDb.firmMembership.findFirst).toHaveBeenLastCalledWith({
        where: {
          userId: "user-1",
          firmId: "firm-1",
          status: "ACTIVE",
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
    });
  });

  describe("listMembers", () => {
    it("lists active firm members", async () => {
      mockDb.firmMembership.findMany.mockResolvedValue([]);

      await FirmModel.listMembers("firm-1");

      expect(mockDb.firmMembership.findMany).toHaveBeenCalledWith({
        where: { firmId: "firm-1", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
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
    });
  });

  describe("addExistingUserByEmail", () => {
    it("returns USER_NOT_FOUND when the email has no user", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await FirmModel.addExistingUserByEmail({
        firmId: "firm-1",
        email: "missing@example.com",
        role: "ANALYST",
      });

      expect(result).toEqual({ added: false, reason: "USER_NOT_FOUND" });
      expect(mockDb.firmMembership.create).not.toHaveBeenCalled();
    });

    it("creates an active membership for an existing user", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: "user-2" });
      mockDb.firmMembership.create.mockResolvedValue({ id: "member-1" });

      const result = await FirmModel.addExistingUserByEmail({
        firmId: "firm-1",
        email: "user@example.com",
        role: "ANALYST",
      });

      expect(result).toEqual({ added: true });
      expect(mockDb.firmMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId: "firm-1",
          userId: "user-2",
          role: "ANALYST",
          status: "ACTIVE",
        }),
      });
    });
  });

  describe("updateMemberRole", () => {
    it("updates a membership scoped to the firm", async () => {
      mockDb.firmMembership.updateMany.mockResolvedValue({ count: 1 });

      const result = await FirmModel.updateMemberRole({
        firmId: "firm-1",
        membershipId: "member-1",
        role: "REVIEWER",
      });

      expect(result).toBe(true);
      expect(mockDb.firmMembership.updateMany).toHaveBeenCalledWith({
        where: {
          id: "member-1",
          firmId: "firm-1",
          status: "ACTIVE",
        },
        data: { role: "REVIEWER" },
      });
    });
  });
});
