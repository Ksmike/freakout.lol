import { db } from "@/lib/db";
import { FirmRole } from "@/lib/generated/prisma/client";
import crypto from "crypto";

const INVITE_EXPIRY_DAYS = 7;

export const InvitationModel = {
  async create(input: {
    firmId: string;
    email: string;
    role: FirmRole;
    invitedBy: string;
  }) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // Upsert: replace any existing pending invite for this email+firm
    await db.firmInvitation.deleteMany({
      where: {
        firmId: input.firmId,
        email: input.email,
        acceptedAt: null,
      },
    });

    return db.firmInvitation.create({
      data: {
        firmId: input.firmId,
        email: input.email,
        role: input.role,
        token,
        invitedBy: input.invitedBy,
        expiresAt,
      },
    });
  },

  async findByToken(token: string) {
    return db.firmInvitation.findUnique({
      where: { token },
      include: {
        firm: { select: { id: true, name: true } },
      },
    });
  },

  async accept(token: string, userId: string) {
    const invite = await this.findByToken(token);

    if (!invite) {
      return { error: "Invitation not found." };
    }
    if (invite.acceptedAt) {
      return { error: "This invitation has already been used." };
    }
    if (invite.expiresAt < new Date()) {
      return { error: "This invitation has expired." };
    }

    // Create the membership
    await db.firmMembership.upsert({
      where: { firmId_userId: { firmId: invite.firmId, userId } },
      create: {
        firmId: invite.firmId,
        userId,
        role: invite.role,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
      update: {
        role: invite.role,
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    // Mark invite as accepted
    await db.firmInvitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });

    return { firmId: invite.firmId, firmName: invite.firm.name };
  },

  async listPendingForFirm(firmId: string) {
    return db.firmInvitation.findMany({
      where: {
        firmId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  },

  async revoke(invitationId: string, firmId: string): Promise<boolean> {
    const result = await db.firmInvitation.deleteMany({
      where: { id: invitationId, firmId },
    });
    return result.count > 0;
  },
};
