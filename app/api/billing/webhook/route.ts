import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, getStripeWebhookSecret } from "@/lib/stripe";
import { BillingModel } from "@/lib/models/BillingModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { db } from "@/lib/db";
import {
  AuditAction,
  BillingInterval,
  SubscriptionStatus,
} from "@/lib/generated/prisma/client";

// Stripe sends the raw body — Next.js must not parse it.
export const runtime = "nodejs";

function toSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    trialing: SubscriptionStatus.TRIALING,
    active: SubscriptionStatus.ACTIVE,
    past_due: SubscriptionStatus.PAST_DUE,
    canceled: SubscriptionStatus.CANCELED,
    unpaid: SubscriptionStatus.UNPAID,
    paused: SubscriptionStatus.PAUSED,
    incomplete: SubscriptionStatus.PAST_DUE,
    incomplete_expired: SubscriptionStatus.CANCELED,
  };
  return map[status] ?? SubscriptionStatus.ACTIVE;
}

function toBillingInterval(interval: Stripe.Price.Recurring.Interval): BillingInterval {
  return interval === "year" ? BillingInterval.ANNUAL : BillingInterval.MONTHLY;
}

async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription,
  auditAction: AuditAction
): Promise<void> {
  const firmId = subscription.metadata?.firmId;
  if (!firmId) return;

  const customer = await BillingModel.findCustomerByFirmId(firmId);
  if (!customer) return;

  const priceItem = subscription.items.data[0];
  const price = priceItem?.price;
  const interval = price?.recurring?.interval ?? "month";

  await BillingModel.upsertSubscription({
    billingCustomerId: customer.id,
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

  // Derive plan from price metadata or product metadata
  const planKey = (price?.metadata?.plan as string | undefined) ?? "starter";

  // Update firm plan and billing status
  await db.firm.update({
    where: { id: firmId },
    data: {
      plan: planKey,
      billingStatus: subscription.status,
    },
  });

  // Upsert entitlements for the new plan
  await BillingModel.upsertEntitlement(firmId, planKey);

  // Find the firm owner for audit attribution
  const ownerMembership = await db.firmMembership.findFirst({
    where: { firmId, role: "OWNER", status: "ACTIVE" },
    select: { userId: true },
  });

  if (ownerMembership) {
    await AuditLogModel.record({
      firmId,
      actorUserId: ownerMembership.userId,
      action: auditAction,
      targetType: "Subscription",
      targetId: subscription.id,
      metadata: { status: subscription.status, plan: planKey },
    });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const customer = await BillingModel.findCustomerByStripeId(customerId);
  if (!customer) return;

  const ownerMembership = await db.firmMembership.findFirst({
    where: { firmId: customer.firmId, role: "OWNER", status: "ACTIVE" },
    select: { userId: true },
  });

  if (ownerMembership) {
    await AuditLogModel.record({
      firmId: customer.firmId,
      actorUserId: ownerMembership.userId,
      action: AuditAction.BILLING_PAYMENT_SUCCEEDED,
      targetType: "Invoice",
      targetId: invoice.id ?? "unknown",
      metadata: { amountPaid: invoice.amount_paid },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const customer = await BillingModel.findCustomerByStripeId(customerId);
  if (!customer) return;

  // Mark firm billing status as past_due
  await db.firm.update({
    where: { id: customer.firmId },
    data: { billingStatus: "past_due" },
  });

  const ownerMembership = await db.firmMembership.findFirst({
    where: { firmId: customer.firmId, role: "OWNER", status: "ACTIVE" },
    select: { userId: true },
  });

  if (ownerMembership) {
    await AuditLogModel.record({
      firmId: customer.firmId,
      actorUserId: ownerMembership.userId,
      action: AuditAction.BILLING_PAYMENT_FAILED,
      targetType: "Invoice",
      targetId: invoice.id ?? "unknown",
      metadata: { amountDue: invoice.amount_due },
    });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, getStripeWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: skip already-processed events
  const firmId =
    (event.data.object as { metadata?: { firmId?: string } })?.metadata?.firmId ??
    null;

  const { isNew } = await BillingModel.recordInvoiceEvent({
    firmId,
    stripeEventId: event.id,
    eventType: event.type,
    payload: event.data.object as object,
  });

  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
          AuditAction.BILLING_SUBSCRIPTION_CREATED
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
          AuditAction.BILLING_SUBSCRIPTION_UPDATED
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription,
          AuditAction.BILLING_SUBSCRIPTION_CANCELED
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Unhandled event types are silently accepted
        break;
    }
  } catch (err) {
    console.error(`[billing/webhook] Error processing ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
