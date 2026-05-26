"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getFirmPermissions,
  hasFirmPermission,
} from "@/lib/authz/permissions";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { FirmModel } from "@/lib/models/FirmModel";
import { InvitationModel } from "@/lib/models/InvitationModel";
import { AuditAction, FirmRole } from "@/lib/generated/prisma/client";
import { resend, FROM_ADDRESS, getAppUrl } from "@/lib/email";
import { renderInviteEmail } from "@/lib/emails/render-invite";
import { inviteEmailText } from "@/lib/emails/invite";
import {
  getActiveFirmIdFromCookie,
  setActiveFirmCookie,
} from "@/lib/active-firm";

export type ActiveFirmSummary = {
  id: string;
  name: string;
  slug: string;
  role: FirmRole;
  plan: string;
  billingStatus: string;
  permissions: string[];
};

export type FirmMemberSummary = {
  id: string;
  name: string | null;
  email: string;
  role: FirmRole;
  status: string;
};

export type FirmAuditLogSummary = {
  id: string;
  action: string;
  actorLabel: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

const MANAGEABLE_ROLES = new Set<FirmRole>([
  FirmRole.ADMIN,
  FirmRole.PARTNER,
  FirmRole.ANALYST,
  FirmRole.REVIEWER,
  FirmRole.VIEWER,
]);

function parseManageableRole(value: FormDataEntryValue | null): FirmRole | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!Object.values(FirmRole).includes(value as FirmRole)) {
    return null;
  }
  const role = value as FirmRole;
  return MANAGEABLE_ROLES.has(role) ? role : null;
}

export async function getActiveFirmSummary(): Promise<ActiveFirmSummary | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const preferredFirmId = await getActiveFirmIdFromCookie();
  const firm = await FirmModel.getActiveFirmSummaryForUser(
    session.user.id,
    preferredFirmId
  );

  return {
    id: firm.firmId,
    name: firm.name,
    slug: firm.slug,
    role: firm.role,
    plan: firm.plan,
    billingStatus: firm.billingStatus,
    permissions: getFirmPermissions(firm.role),
  };
}

export async function listFirmMembers(): Promise<FirmMemberSummary[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "members.manage_roles")) {
    return [];
  }

  const members = await FirmModel.listMembers(firm.firmId);

  return members.map((member) => ({
    id: member.id,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    status: member.status,
  }));
}

export async function listFirmAuditLogs(): Promise<FirmAuditLogSummary[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "audit.view")) {
    return [];
  }

  const logs = await AuditLogModel.listForFirm({
    firmId: firm.firmId,
    take: 10,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorLabel: log.actor.name ?? log.actor.email,
    targetType: log.targetType,
    targetId: log.targetId,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function addFirmMemberByEmail(
  formData: FormData
): Promise<{ error?: string; invited?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "members.invite")) {
    return { error: "You do not have permission to invite members." };
  }

  // Entitlement check: seat limit
  const { BillingModel } = await import("@/lib/models/BillingModel");
  const seatCheck = await BillingModel.checkSeatAvailability(firm.firmId);
  if (!seatCheck.allowed) {
    return { error: seatCheck.reason };
  }

  const emailEntry = formData.get("email");
  const email = typeof emailEntry === "string" ? emailEntry.trim().toLowerCase() : "";
  const role = parseManageableRole(formData.get("role"));

  if (!email || !role) {
    return { error: "Enter a valid email and role." };
  }

  const result = await FirmModel.addExistingUserByEmail({
    firmId: firm.firmId,
    email,
    role,
  });

  if (!result.added) {
    // User not registered — send an email invitation instead
    const session2 = await auth();
    const inviterName = session2?.user?.name ?? session2?.user?.email ?? "A team member";

    const invitation = await InvitationModel.create({
      firmId: firm.firmId,
      email,
      role,
      invitedBy: session.user.id,
    });

    const acceptUrl = `${getAppUrl()}/invite/${invitation.token}`;
    const html = await renderInviteEmail({
      firmName: firm.name,
      inviterName,
      role,
      acceptUrl,
      expiresInDays: 7,
    });

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: `You've been invited to join ${firm.name} on Freakout`,
      html,
      text: inviteEmailText({
        firmName: firm.name,
        inviterName,
        role,
        acceptUrl,
        expiresInDays: 7,
      }),
    });

    revalidatePath("/settings/account");
    return { invited: true };
  }
  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.FIRM_MEMBER_ADDED,
    targetType: "FirmMembership",
    targetId: email,
    metadata: {
      email,
      role,
    },
  });

  revalidatePath("/settings/account");
  return {};
}

export async function updateFirmMemberRole(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "members.manage_roles")) {
    return { error: "You do not have permission to manage member roles." };
  }

  const membershipIdEntry = formData.get("membershipId");
  const membershipId =
    typeof membershipIdEntry === "string" ? membershipIdEntry.trim() : "";
  const role = parseManageableRole(formData.get("role"));

  if (!membershipId || !role) {
    return { error: "Enter a valid member and role." };
  }

  const updated = await FirmModel.updateMemberRole({
    firmId: firm.firmId,
    membershipId,
    role,
  });

  if (!updated) {
    return { error: "Member not found." };
  }

  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.FIRM_MEMBER_ROLE_UPDATED,
    targetType: "FirmMembership",
    targetId: membershipId,
    metadata: {
      role,
    },
  });

  revalidatePath("/settings/account");
  return {};
}

export type PendingInvitationSummary = {
  id: string;
  email: string;
  role: FirmRole;
  expiresAt: string;
  createdAt: string;
};

export async function listPendingInvitations(): Promise<PendingInvitationSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "members.invite")) return [];

  const { InvitationModel } = await import("@/lib/models/InvitationModel");
  const invites = await InvitationModel.listPendingForFirm(firm.firmId);

  return invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }));
}

export async function revokeInvitation(
  invitationId: string
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  if (!hasFirmPermission(firm.role, "members.invite")) {
    return { error: "You do not have permission to revoke invitations." };
  }

  const { InvitationModel } = await import("@/lib/models/InvitationModel");
  const revoked = await InvitationModel.revoke(invitationId, firm.firmId);
  if (!revoked) return { error: "Invitation not found." };

  revalidatePath("/settings/account");
  return {};
}

export type UserFirmSummary = {
  id: string;
  name: string;
  slug: string;
  role: FirmRole;
  plan: string;
  isActive: boolean;
};

export async function listUserFirms(): Promise<UserFirmSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const [firms, activeFirmId] = await Promise.all([
    FirmModel.listFirmsForUser(session.user.id),
    getActiveFirmIdFromCookie(),
  ]);

  // Determine which firm is currently active
  const resolvedActiveId =
    activeFirmId && firms.some((f) => f.firmId === activeFirmId)
      ? activeFirmId
      : firms[0]?.firmId ?? null;

  return firms.map((f) => ({
    id: f.firmId,
    name: f.name,
    slug: f.slug,
    role: f.role,
    plan: f.plan,
    isActive: f.firmId === resolvedActiveId,
  }));
}

export async function switchFirm(firmId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  // Validate the user is actually a member of this firm
  const firms = await FirmModel.listFirmsForUser(session.user.id);
  const target = firms.find((f) => f.firmId === firmId);
  if (!target) return;

  await setActiveFirmCookie(firmId);

  // Redirect to dashboard so all server components re-render with the new firm
  redirect("/dashboard");
}
