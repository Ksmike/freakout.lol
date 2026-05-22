"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  getFirmPermissions,
  hasFirmPermission,
} from "@/lib/authz/permissions";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { FirmModel } from "@/lib/models/FirmModel";
import { AuditAction, FirmRole } from "@/lib/generated/prisma/client";

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

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

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
): Promise<{ error?: string }> {
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
    return { error: "User not found. Ask them to register first." };
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

  revalidatePath("/settings");
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

  revalidatePath("/settings");
  return {};
}
