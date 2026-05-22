import {
  LuBuilding2,
  LuClipboardList,
  LuCreditCard,
  LuKey,
  LuNetwork,
  LuShield,
  LuUsers,
} from "react-icons/lu";
import { getApiKeyStatuses } from "@/lib/actions/apiKeys";
import {
  addFirmMemberByEmail,
  getActiveFirmSummary,
  listFirmAuditLogs,
  listFirmMembers,
  listPendingInvitations,
  revokeInvitation,
  updateFirmMemberRole,
} from "@/lib/actions/firm";
import { getBillingSummary, createCheckoutSession, createPortalSession } from "@/lib/actions/billing";
import { listAvailableGraphs, enableGraph, disableGraph } from "@/lib/actions/graph";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { getLabelsForLocale } from "@/labels";
import { FirmRole } from "@/lib/generated/prisma/client";

export const metadata = {
  title: "Settings | KG Qualify",
};

const MANAGEABLE_ROLES = [
  FirmRole.ADMIN,
  FirmRole.PARTNER,
  FirmRole.ANALYST,
  FirmRole.REVIEWER,
  FirmRole.VIEWER,
];

export default async function SettingsPage() {
  const { labels } = getLabelsForLocale("en");
  const [apiKeyStatuses, firm, members, auditLogs, billing, availableGraphs, pendingInvites] = await Promise.all([
    getApiKeyStatuses(),
    getActiveFirmSummary(),
    listFirmMembers(),
    listFirmAuditLogs(),
    getBillingSummary(),
    listAvailableGraphs(),
    listPendingInvitations(),
  ]);
  const t = labels.app.settings;
  const tGraph = labels.app.graphWorkflow;
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
    <div className="mx-auto w-full min-w-0 max-w-2xl overflow-x-hidden">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">{t.heading}</h1>
        <p className="mt-1.5 text-sm text-foreground/60">
          {t.description}
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <LuBuilding2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t.firmHeading}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              {t.firmDescription}
            </p>
          </div>
        </div>

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
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <LuUsers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t.membersHeading}
              </h2>
              <p className="mt-0.5 text-sm text-foreground/60">
                {t.membersDescription}
              </p>
            </div>
          </div>

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

          {/* Pending invitations */}
          {pendingInvites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                Pending invitations
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
                      {invite.role} · expires{" "}
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
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {firm?.permissions.includes("audit.view") && (
        <section className="mb-8">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <LuClipboardList className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t.auditHeading}
              </h2>
              <p className="mt-0.5 text-sm text-foreground/60">
                {t.auditDescription}
              </p>
            </div>
          </div>

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
                      <p className="font-medium text-foreground">
                        {log.action}
                      </p>
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

      {/* Graph workflow enablement */}
      {firm?.permissions.includes("graphs.enable") && (
        <section className="mb-8">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <LuNetwork className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {tGraph.enabledGraphsHeading}
              </h2>
              <p className="mt-0.5 text-sm text-foreground/60">
                {tGraph.enabledGraphsDescription}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {availableGraphs.length === 0 ? (
              <p className="rounded-lg border border-divider bg-content1 p-4 text-sm text-foreground/55">
                {tGraph.noGraphsAvailable}
              </p>
            ) : (
              availableGraphs.map((graph) => (
                <div
                  key={graph.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-divider bg-content1 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {graph.name}
                      </p>
                      {graph.isEnabledForFirm && (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          {tGraph.enabledBadge}
                        </span>
                      )}
                    </div>
                    {graph.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-foreground/60">
                        {graph.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-foreground/40">
                      {graph.requirementCount} {tGraph.requirementsCount}
                    </p>
                  </div>
                  {graph.isEnabledForFirm ? (
                    <form
                      action={async () => {
                        "use server";
                        await disableGraph(graph.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="shrink-0 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-content2"
                      >
                        {tGraph.disableCta}
                      </button>
                    </form>
                  ) : (
                    <form
                      action={async () => {
                        "use server";
                        await enableGraph(graph.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        {tGraph.enableCta}
                      </button>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Billing section */}
      <section className="mb-8">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <LuCreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t.billingHeading}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              {t.billingDescription}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-divider bg-content1 p-4 space-y-4">
          {/* Plan + status */}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.billingPlanLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground capitalize">
                {billing?.plan ?? "starter"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {t.billingStatusLabel}
              </dt>
              <dd className="mt-1 font-medium text-foreground capitalize">
                {billing?.billingStatus ?? "trialing"}
              </dd>
            </div>
            {billing?.subscription?.currentPeriodEnd && (
              <div>
                <dt className="text-xs font-medium uppercase text-foreground/45">
                  {t.billingPeriodEndLabel}
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en", {
                    dateStyle: "medium",
                  })}
                  {billing.subscription.cancelAtPeriodEnd && (
                    <span className="ml-2 text-xs text-warning">(cancels)</span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {/* Usage meters */}
          {billing?.usage && billing.entitlement && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-foreground/45">
                {t.billingUsageHeading}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  {
                    label: t.billingUploadsLabel,
                    used: billing.usage.uploadsCount,
                    max: billing.entitlement.maxUploadsMonth,
                  },
                  {
                    label: t.billingRunsLabel,
                    used: billing.usage.runsCount,
                    max: billing.entitlement.maxRunsMonth,
                  },
                  {
                    label: t.billingExportsLabel,
                    used: billing.usage.exportsCount,
                    max: billing.entitlement.maxExportsMonth,
                  },
                ].map(({ label, used, max }) => {
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  const isNearLimit = pct >= 80;
                  return (
                    <div key={label} className="rounded-md border border-divider bg-background p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground/60">{label}</span>
                        <span className={`font-medium ${isNearLimit ? "text-warning" : "text-foreground"}`}>
                          {used} / {max}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-content2">
                        <div
                          className={`h-full rounded-full transition-all ${isNearLimit ? "bg-warning" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                          role="progressbar"
                          aria-valuenow={used}
                          aria-valuemin={0}
                          aria-valuemax={max}
                          aria-label={label}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!billing?.subscription && (
            <p className="text-sm text-foreground/60">{t.billingNoSubscription}</p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {billing?.hasStripeCustomer ? (
              <form
                action={async () => {
                  "use server";
                  await createPortalSession();
                }}
              >
                <button
                  type="submit"
                  className="rounded-md border border-divider px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-content2"
                >
                  {t.billingManageCta}
                </button>
              </form>
            ) : (
              <form action={createCheckoutSession.bind(null, process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "")}>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t.billingUpgradeCta}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* API Keys section */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <LuKey className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t.apiKeysHeading}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              {t.apiKeysDescription}
            </p>
          </div>
        </div>

        <ApiKeySection initial={apiKeyStatuses} />

        {/* Encryption note */}
        <div className="mt-4 flex items-center gap-2 text-xs text-foreground/40">
          <LuShield className="h-3.5 w-3.5 shrink-0" />
          <span>{t.encryptionNote}</span>
        </div>
      </section>
    </div>
  );
}
