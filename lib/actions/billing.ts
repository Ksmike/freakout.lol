"use server";

import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { BillingModel } from "@/lib/models/BillingModel";
import { FirmModel } from "@/lib/models/FirmModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { db } from "@/lib/db";
import { resolvePlanFromStripePrice } from "@/lib/billing/stripe-plan";
import { getRequestAppUrl } from "@/lib/app-url";
import {
  AuditAction,
  BillingInterval,
  SubscriptionStatus,
} from "@/lib/generated/prisma/client";

export type BillingSyncResult =
  | { status: "synced"; plan: string; subscriptionStatus: string }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

function toSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELED,
    incomplete: SubscriptionStatus.PAST_DUE,
    incomplete_expired: SubscriptionStatus.CANCELED,
    past_due: SubscriptionStatus.PAST_DUE,
    paused: SubscriptionStatus.PAUSED,
    trialing: SubscriptionStatus.TRIALING,
    unpaid: SubscriptionStatus.UNPAID,
  };
  return map[status] ?? SubscriptionStatus.ACTIVE;
}

function toBillingInterval(interval: Stripe.Price.Recurring.Interval): BillingInterval {
  return interval === "year" ? BillingInterval.ANNUAL : BillingInterval.MONTHLY;
}

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

  const appUrl = await getRequestAppUrl();
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings/billing?billing=canceled`,
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
 * Reconciles the just-completed Stripe Checkout session before rendering Settings.
 * This keeps local development and delayed webhooks from showing stale plan state.
 */
export async function syncCheckoutSession(
  checkoutSessionId: string
): Promise<BillingSyncResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error", message: "Not authenticated." };
    }

    if (!checkoutSessionId) {
      return {
        status: "pending",
        message: "Stripe returned without a checkout session id.",
      };
    }

    const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      { expand: ["subscription", "subscription.items.data.price.product"] }
    );

  if (checkoutSession.metadata?.firmId !== firm.firmId) {
    return {
      status: "error",
      message: "Checkout session does not belong to the active firm.",
    };
  }

  if (checkoutSession.mode !== "subscription") {
    return {
      status: "error",
      message: "Checkout session was not a subscription checkout.",
    };
  }

  const stripeCustomerId =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer?.id;
  if (!stripeCustomerId) {
    return {
      status: "pending",
      message: "Stripe has not attached a customer to this checkout session yet.",
    };
  }

  const existingCustomer = await BillingModel.findCustomerByFirmId(firm.firmId);
  let billingCustomerId = existingCustomer?.id;
  if (!billingCustomerId) {
    const createdCustomer = await BillingModel.upsertCustomer({
      firmId: firm.firmId,
      stripeCustomerId,
      billingEmail: session.user.email ?? null,
    });
    billingCustomerId = createdCustomer.id;
  }

  const subscription =
    typeof checkoutSession.subscription === "string"
      ? await stripe.subscriptions.retrieve(checkoutSession.subscription, {
          expand: ["items.data.price.product"],
        })
      : checkoutSession.subscription;

  if (!subscription) {
    return {
      status: "pending",
      message: "Stripe has not created the subscription yet.",
    };
  }

  const priceItem = subscription.items.data[0];
  const price = priceItem?.price;
  const interval = price?.recurring?.interval ?? "month";
  const planKey = await resolvePlanFromStripePrice(stripe, price);

  await BillingModel.upsertSubscription({
    billingCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id ?? "",
    status: toSubscriptionStatus(subscription.status),
    interval: toBillingInterval(interval),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000)
      : null,
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
  });

  await db.firm.update({
    where: { id: firm.firmId },
    data: {
      plan: planKey,
      billingStatus: subscription.status,
    },
  });

  await BillingModel.upsertEntitlement(firm.firmId, planKey);
  revalidatePath("/settings/billing");

  return {
    status: "synced",
    plan: planKey,
    subscriptionStatus: subscription.status,
  };
  } catch (error) {
    console.error("[syncCheckoutSession] Error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unexpected error syncing checkout session.",
    };
  }
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

  const appUrl = await getRequestAppUrl();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  redirect(portalSession.url);
}

export async function cancelSubscriptionAtPeriodEnd(): Promise<{
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  const customer = await BillingModel.findCustomerByFirmId(firm.firmId);
  const subscription = customer?.subscription;

  if (!subscription) {
    return {
      error: "No active subscription found. Use Manage billing to open Stripe.",
    };
  }

  if (subscription.cancelAtPeriodEnd) {
    return {};
  }

  const updated = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    { cancel_at_period_end: true }
  );

  await BillingModel.updateSubscriptionCancellation({
    stripeSubscriptionId: updated.id,
    status: toSubscriptionStatus(updated.status),
    currentPeriodEnd: new Date(updated.current_period_end * 1000),
    cancelAtPeriodEnd: updated.cancel_at_period_end,
    canceledAt: updated.canceled_at
      ? new Date(updated.canceled_at * 1000)
      : null,
  });

  await db.firm.update({
    where: { id: firm.firmId },
    data: { billingStatus: updated.status },
  });

  await AuditLogModel.record({
    firmId: firm.firmId,
    actorUserId: session.user.id,
    action: AuditAction.BILLING_SUBSCRIPTION_CANCELED,
    targetType: "Subscription",
    targetId: updated.id,
    metadata: { cancelAtPeriodEnd: updated.cancel_at_period_end },
  });

  revalidatePath("/settings/billing");
  return {};
}

/**
 * Creates a Stripe Checkout session for a single seat at the per-seat price.
 * Used by the paywall upgrade CTA. If the firm already has a subscription,
 * this adds a seat to the existing subscription instead.
 */
export async function createSeatCheckoutSession(): Promise<never> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const seatPriceId = process.env.STRIPE_SEAT_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_SEAT_PRICE_ID;
  if (!seatPriceId) {
    throw new Error("STRIPE_SEAT_PRICE_ID is not configured.");
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

  // Check if the firm already has a subscription — if so, add a seat
  const existingCustomer = await BillingModel.findCustomerByFirmId(firm.firmId);
  if (existingCustomer?.subscription) {
    // Retrieve the subscription and increment quantity
    const sub = await stripe.subscriptions.retrieve(
      existingCustomer.subscription.stripeSubscriptionId,
      { expand: ["items.data"] }
    );
    const item = sub.items.data[0];
    if (item) {
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, quantity: (item.quantity ?? 1) + 1 }],
        proration_behavior: "create_prorations",
      });
      // Update local entitlement
      await BillingModel.updateSeatCount(firm.firmId, (item.quantity ?? 1) + 1);
      revalidatePath("/settings/billing");
      redirect("/settings/billing?billing=success");
    }
  }

  // No existing subscription — create a new checkout for 1 seat
  let stripeCustomerId: string | undefined;
  if (existingCustomer) {
    stripeCustomerId = existingCustomer.stripeCustomerId;
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

  const appUrl = await getRequestAppUrl();
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: seatPriceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings/billing?billing=canceled`,
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
 * Removes one seat from the firm's subscription.
 * Blocks removal if the firm has more active members than the resulting seat count.
 * Cannot go below 1 seat (use cancel instead).
 */
export async function removeSeat(): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);
  const customer = await BillingModel.findCustomerByFirmId(firm.firmId);
  const subscription = customer?.subscription;

  if (!subscription) {
    return { error: "No active subscription found." };
  }

  // Retrieve current quantity from Stripe
  const sub = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
    { expand: ["items.data"] }
  );
  const item = sub.items.data[0];
  const currentQuantity = item?.quantity ?? 1;

  if (currentQuantity <= 1) {
    return { error: "Cannot remove the last seat. Cancel the subscription instead." };
  }

  // Guard: don't allow fewer seats than active members
  const activeMemberCount = await db.firmMembership.count({
    where: { firmId: firm.firmId, status: "ACTIVE" },
  });

  const newQuantity = currentQuantity - 1;
  if (newQuantity < activeMemberCount) {
    return {
      error: `Your firm has ${activeMemberCount} active member${activeMemberCount === 1 ? "" : "s"}. Remove a member before reducing seats.`,
    };
  }

  // Decrement in Stripe
  await stripe.subscriptions.update(sub.id, {
    items: [{ id: item!.id, quantity: newQuantity }],
    proration_behavior: "create_prorations",
  });

  // Update local entitlement
  await BillingModel.updateSeatCount(firm.firmId, newQuantity);
  revalidatePath("/settings/billing");
  return {};
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
