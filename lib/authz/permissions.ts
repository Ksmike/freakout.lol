import { FirmRole } from "@/lib/generated/prisma/client";

export type FirmPermission =
  | "billing.manage"
  | "members.invite"
  | "members.manage_roles"
  | "graphs.enable"
  | "graphs.configure_firm"
  | "projects.create"
  | "projects.view_all"
  | "documents.upload"
  | "documents.delete"
  | "workflow.run"
  | "evidence.review"
  | "outputs.approve"
  | "exports.create"
  | "audit.view";

const ROLE_PERMISSIONS: Record<FirmRole, ReadonlySet<FirmPermission>> = {
  [FirmRole.OWNER]: new Set<FirmPermission>([
    "billing.manage",
    "members.invite",
    "members.manage_roles",
    "graphs.enable",
    "graphs.configure_firm",
    "projects.create",
    "projects.view_all",
    "documents.upload",
    "documents.delete",
    "workflow.run",
    "evidence.review",
    "outputs.approve",
    "exports.create",
    "audit.view",
  ]),
  [FirmRole.ADMIN]: new Set<FirmPermission>([
    "members.invite",
    "members.manage_roles",
    "graphs.enable",
    "graphs.configure_firm",
    "projects.create",
    "projects.view_all",
    "documents.upload",
    "documents.delete",
    "workflow.run",
    "evidence.review",
    "outputs.approve",
    "exports.create",
    "audit.view",
  ]),
  [FirmRole.PARTNER]: new Set<FirmPermission>([
    "projects.create",
    "projects.view_all",
    "documents.upload",
    "documents.delete",
    "workflow.run",
    "evidence.review",
    "outputs.approve",
    "exports.create",
    "audit.view",
  ]),
  [FirmRole.ANALYST]: new Set<FirmPermission>([
    "projects.create",
    "documents.upload",
    "documents.delete",
    "workflow.run",
    "evidence.review",
    "exports.create",
  ]),
  [FirmRole.REVIEWER]: new Set<FirmPermission>([
    "evidence.review",
    "outputs.approve",
  ]),
  [FirmRole.VIEWER]: new Set<FirmPermission>([]),
};

export function getFirmPermissions(role: FirmRole): FirmPermission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}

export function hasFirmPermission(
  role: FirmRole,
  permission: FirmPermission
): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
