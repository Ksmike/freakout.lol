"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { BillingModel } from "@/lib/models/BillingModel";
import { FirmModel } from "@/lib/models/FirmModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { AuditAction } from "@/lib/generated/prisma/client";

const APP_URL = process.env.AUTH_URL ?? "https://localhost:3000";

/**
 * Creates a Stripe Checkout session for the given price and redirects to it.
 * If the firm already has a Stripe customer, it is reused.
 */
export async function createCheckoutSession(
  stripePriceId: string
): Promise<never> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

  // Ensure a Stripe customer exists for this firm
  let stripeCustomerId: string | undefined;
  const existing = await BillingModel.findCustomerByFirmId(firm.firmId);
  if (existing) {
    stripeCustomerId = existing.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: firm.name,
      metadata: { firmId: firm.firmId },
    });
    await BillingModel.upsertCustomer({
      firmId: firm.firmId,
      stripeCustomerId: customer.id,
      billingEmail: session.user.email ?? null,
    });
    stripeCustomerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${APP_URL}/settings?billing=success`,
    cancel_url: `${APP_URL}/settings?billing=canceled`,
    metadata: { firmId: firm.firmId },
    subscription_data: {
      metadata: { firmId: firm.firmId },
    },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(checkoutSession.url);
}

/**
 * Creates a Stripe Customer Portal session and redirects to it.
 * Requires the firm to already have a Stripe customer.
 */
export async function createPortalSession(): Promise<{ error?: string } | never> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  const customer = await BillingModel.findCustomerByFirmId(firm.firmId);

  if (!customer) {
    return { error: "No billing account found. Subscribe to a plan first." };
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${APP_URL}/settings`,
  });

  redirect(portalSession.url);
}

/**
 * Returns the current billing summary for the active firm.
 */
export async function getBillingSummary(): Promise<{
  plan: string;
  billingStatus: string;
  hasStripeCustomer: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  entitlement: {
    maxSeats: number;
    maxProjects: number;
    maxUploadsMonth: number;
    maxRunsMonth: number;
    maxExportsMonth: number;
  } | null;
  usage: {
    uploadsCount: number;
    runsCount: number;
    exportsCount: number;
  } | null;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

  const [customer, entitlement, meter] = await Promise.all([
    BillingModel.findCustomerByFirmId(firm.firmId),
    BillingModel.getEntitlement(firm.firmId),
    BillingModel.getOrCreateUsageMeter(firm.firmId),
  ]);

  return {
    plan: firm.plan,
    billingStatus: firm.billingStatus,
    hasStripeCustomer: !!customer,
    subscription: customer?.subscription
      ? {
          status: customer.subscription.status,
          currentPeriodEnd: customer.subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: customer.subscription.cancelAtPeriodEnd,
        }
      : null,
    entitlement: entitlement
      ? {
          maxSeats: entitlement.maxSeats,
          maxProjects: entitlement.maxProjects,
          maxUploadsMonth: entitlement.maxUploadsMonth,
          maxRunsMonth: entitlement.maxRunsMonth,
          maxExportsMonth: entitlement.maxExportsMonth,
        }
      : null,
    usage: meter
      ? {
          uploadsCount: meter.uploadsCount,
          runsCount: meter.runsCount,
          exportsCount: meter.exportsCount,
        }
      : null,
  };
}

/**
 * Records a billing audit event. Called from the webhook handler.
 */
export async function recordBillingAuditEvent(input: {
  firmId: string;
  actorUserId: string;
  action: AuditAction;
  targetId: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await AuditLogModel.record({
    firmId: input.firmId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: "Subscription",
    targetId: input.targetId,
    metadata: input.metadata as Parameters<typeof AuditLogModel.record>[0]["metadata"],
  });
}
