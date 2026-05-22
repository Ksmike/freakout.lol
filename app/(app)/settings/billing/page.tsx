import {
  LuCircleCheck,
  LuCreditCard,
  LuTriangleAlert,
} from "react-icons/lu";
import { CancelSubscriptionForm } from "./CancelSubscriptionForm";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingSummary,
  syncCheckoutSession,
  type BillingSyncResult,
} from "@/lib/actions/billing";
import { getLabelsForLocale } from "@/labels";
import type { AppLabels } from "@/labels/types";

export const metadata = {
  title: "Billing | KG Qualify",
};

type BillingSettingsPageProps = {
  searchParams: Promise<{
    billing?: string | string[];
    session_id?: string | string[];
  }>;
};

export default async function BillingSettingsPage({
  searchParams,
}: BillingSettingsPageProps) {
  const { labels } = getLabelsForLocale("en");
  const resolvedSearchParams = await searchParams;
  const billingReturn = getSearchParam(resolvedSearchParams.billing);
  const checkoutSessionId = getSearchParam(resolvedSearchParams.session_id);
  const billingSync =
    billingReturn === "success"
      ? await syncCheckoutSession(checkoutSessionId ?? "").catch(
          (): BillingSyncResult => ({
            status: "error",
            message: "Failed to sync checkout session. Please refresh the page.",
          })
        )
      : null;
  const billing = await getBillingSummary();
  const t = labels.app.settings;
  const billingNotice = getBillingNotice(billingReturn, billingSync, t);
  const subscriptionStatus = billing?.subscription?.status;
  const displayStatus =
    subscriptionStatus ?? billing?.billingStatus ?? "trialing";
  const hasActiveSubscription =
    isActiveSubscriptionStatus(subscriptionStatus);
  const canCancelSubscription =
    hasActiveSubscription && !billing?.subscription?.cancelAtPeriodEnd;

  return (
    <div className="max-w-3xl">
      <SettingsSectionHeader
        icon={<LuCreditCard className="h-4 w-4" aria-hidden="true" />}
        title={t.billingHeading}
        description={t.billingDescription}
      />

      {billingNotice && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${
            billingNotice.tone === "success"
              ? "border-success/30 bg-success/10"
              : "border-warning/30 bg-warning/10"
          }`}
        >
          {billingNotice.tone === "success" ? (
            <LuCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          )}
          <div>
            <p
              className={`text-sm font-semibold ${
                billingNotice.tone === "success" ? "text-success" : "text-warning"
              }`}
            >
              {billingNotice.heading}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {billingNotice.description}
            </p>
          </div>
        </div>
      )}

      <div
        className={`space-y-4 rounded-lg border p-4 ${
          hasActiveSubscription
            ? "border-success/30 bg-success/5"
            : "border-divider bg-content1"
        }`}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-foreground/45">
              {t.billingPlanLabel}
            </dt>
            <dd className="mt-1 font-medium text-foreground capitalize">
              {formatPlanLabel(billing?.plan ?? "starter")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-foreground/45">
              {t.billingStatusLabel}
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="font-medium text-foreground capitalize">
                {formatBillingStatus(displayStatus)}
              </span>
              {billing?.subscription?.cancelAtPeriodEnd && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  {t.billingCancelsLabel}
                </span>
              )}
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
                  <span className="ml-2 text-xs text-warning">
                    ({t.billingCancelsLabel})
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>

        {hasActiveSubscription && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              billing?.subscription?.cancelAtPeriodEnd
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success"
            }`}
          >
            {billing?.subscription?.cancelAtPeriodEnd
              ? t.billingCancelScheduled
              : t.billingActiveSubscription}
          </p>
        )}

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
          <div className="space-y-1 text-sm text-foreground/60">
            <p>{t.billingNoSubscription}</p>
            {billing?.hasStripeCustomer && <p>{t.billingManageToCancel}</p>}
          </div>
        )}

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
          {canCancelSubscription && (
            <CancelSubscriptionForm
              cta={t.billingCancelCta}
              confirmMessage={t.billingCancelConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatPlanLabel(plan: string): string {
  return plan.replace(/_/g, " ");
}

function formatBillingStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

function isActiveSubscriptionStatus(status: string | undefined | null): boolean {
  return status === "ACTIVE" || status === "TRIALING" || status === "active" || status === "trialing";
}

function getBillingNotice(
  billingReturn: string | null,
  syncResult: BillingSyncResult | null,
  labels: AppLabels["app"]["settings"]
): { tone: "success" | "warning"; heading: string; description: string } | null {
  if (billingReturn === "canceled") {
    return {
      tone: "warning",
      heading: labels.billingCanceledHeading,
      description: labels.billingCanceledDescription,
    };
  }

  if (billingReturn !== "success") return null;

  if (syncResult?.status === "synced") {
    return {
      tone: "success",
      heading: labels.billingSuccessHeading,
      description: labels.billingSuccessDescription,
    };
  }

  if (syncResult?.status === "error") {
    return {
      tone: "warning",
      heading: labels.billingSyncErrorHeading,
      description: labels.billingSyncErrorDescription,
    };
  }

  return {
    tone: "warning",
    heading: labels.billingPendingHeading,
    description: labels.billingPendingDescription,
  };
}
