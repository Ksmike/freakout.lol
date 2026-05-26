import {
  LuBuilding2,
  LuClipboardList,
  LuContact,
  LuUsers,
} from "react-icons/lu";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { auth } from "@/lib/auth";
import {
  addFirmMemberByEmail,
  getActiveFirmSummary,
  listFirmAuditLogs,
  listFirmMembers,
  listPendingInvitations,
  revokeInvitation,
  updateFirmMemberRole,
} from "@/lib/actions/firm";
import { getLabelsForLocale } from "@/labels";
import { FirmRole } from "@/lib/generated/prisma/client";

export const metadata = {
  title: "Account & Firm | Freakout.lol",
};

const MANAGEABLE_ROLES = [
  FirmRole.ADMIN,
  FirmRole.PARTNER,
  FirmRole.ANALYST,
  FirmRole.REVIEWER,
  FirmRole.VIEWER,
];

export default async function AccountSettingsPage() {
  const { labels } = getLabelsForLocale("en");
  const session = await auth();
  const [firm, members, auditLogs, pendingInvites] = await Promise.all([
    getActiveFirmSummary(),
    listFirmMembers(),
    listFirmAuditLogs(),
    listPendingInvitations(),
  ]);
  const t = labels.app.settings;
  const canManageMembers =
    firm?.permissions.includes("members.invite") ||
    firm?.permissions.includes("members.manage_roles");

  async function addMemberFormAction(formData: FormData): Promise<void> {
    "use server";

    await addFirmMemberByEmail(formData);
  }

  async function updateMemberRoleFormAction(formData: FormData): Promise<void> {
    "use server";

    await updateFirmMemberRole(formData);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground">{t.accountHeading}</h2>
        <p className="mt-1 text-sm text-foreground/60">{t.accountDescription}</p>
      </div>

      <section className="mb-8">
        <SettingsSectionHeader
          icon={<LuContact className="h-4 w-4" aria-hidden="true" />}
          title={t.contactHeading}
          description={t.contactDescription}
        />
        <dl className="grid gap-3 rounded-lg border border-divider bg-content1 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase text-foreground/45">
              {t.contactNameLabel}
            </dt>
            <dd className="mt-1 font-medium text-foreground">
              {session?.user?.name ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-foreground/45">
              {t.contactEmailLabel}
            </dt>
            <dd className="mt-1 break-words font-medium text-foreground">
              {session?.user?.email ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-foreground/45">
              {t.contactLocaleLabel}
            </dt>
            <dd className="mt-1 font-medium text-foreground">
              {session?.user?.locale ?? "en"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <SettingsSectionHeader
          icon={<LuBuilding2 className="h-4 w-4" aria-hidden="true" />}
          title={t.firmHeading}
          description={t.firmDescription}
        />
        {firm && (
          <dl className="grid gap-3 rounded-lg border border-divider bg-content1 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.firmNameLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground">{firm.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.firmRoleLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground">{firm.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.firmPlanLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground">{firm.plan}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.firmBillingLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {firm.billingStatus}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.firmPermissionsLabel}
              </dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {firm.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-content2 px-2.5 py-1 text-xs font-medium text-foreground/70"
                  >
                    {permission}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {canManageMembers && (
        <section className="mb-8">
          <SettingsSectionHeader
            icon={<LuUsers className="h-4 w-4" aria-hidden="true" />}
            title={t.membersHeading}
            description={t.membersDescription}
          />
          <form
            action={addMemberFormAction}
            className="mb-4 grid gap-3 rounded-lg border border-divider bg-content1 p-4 sm:grid-cols-[1fr_160px_auto]"
          >
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-foreground/55">
                {t.memberEmailLabel}
              </span>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-foreground/55">
                {t.memberRoleLabel}
              </span>
              <select
                name="role"
                defaultValue={FirmRole.ANALYST}
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {MANAGEABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t.memberAddCta}
            </button>
          </form>

          <div className="space-y-2">
            {members.map((member) => (
              <form
                key={member.id}
                action={updateMemberRoleFormAction}
                className="grid gap-3 rounded-lg border border-divider bg-content1 p-4 sm:grid-cols-[1fr_160px_auto]"
              >
                <input type="hidden" name="membershipId" value={member.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.name ?? member.email}
                  </p>
                  <p className="truncate text-xs text-foreground/55">
                    {member.email}
                  </p>
                </div>
                <label className="text-sm">
                  <span className="sr-only">{t.memberRoleLabel}</span>
                  <select
                    name="role"
                    defaultValue={member.role}
                    disabled={member.role === FirmRole.OWNER}
                    className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
                  >
                    {member.role === FirmRole.OWNER && (
                      <option value={FirmRole.OWNER}>{FirmRole.OWNER}</option>
                    )}
                    {MANAGEABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={member.role === FirmRole.OWNER}
                  className="rounded-md border border-divider px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-content2 disabled:opacity-60"
                >
                  {t.memberUpdateCta}
                </button>
              </form>
            ))}
          </div>

          {pendingInvites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                {t.pendingInvitationsHeading}
              </p>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-divider bg-content1 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {invite.email}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {invite.role} - {t.pendingInvitationExpiresLabel}{" "}
                      {new Date(invite.expiresAt).toLocaleDateString("en", {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await revokeInvitation(invite.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-content2"
                    >
                      {t.revokeInvitationCta}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {firm?.permissions.includes("audit.view") && (
        <section>
          <SettingsSectionHeader
            icon={<LuClipboardList className="h-4 w-4" aria-hidden="true" />}
            title={t.auditHeading}
            description={t.auditDescription}
          />
          <div className="rounded-lg border border-divider bg-content1 p-4">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-foreground/55">{t.auditEmpty}</p>
            ) : (
              <ul className="space-y-3">
                {auditLogs.map((log) => (
                  <li
                    key={log.id}
                    className="border-b border-divider pb-3 text-sm last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-foreground">{log.action}</p>
                      <time className="text-xs text-foreground/45">
                        {new Date(log.createdAt).toLocaleString("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-foreground/55">
                      {log.actorLabel} {"->"} {log.targetType}:{log.targetId}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
