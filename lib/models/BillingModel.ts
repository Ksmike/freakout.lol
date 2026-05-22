import { db } from "@/lib/db";
import {
  SubscriptionStatus,
  BillingInterval,
} from "@/lib/generated/prisma/client";

// ─── Plan definitions ────────────────────────────────────────────────────────

export type PlanKey = "starter" | "growth" | "pro";

export type PlanLimits = {
  maxSeats: number;
  maxProjects: number;
  maxUploadsMonth: number;
  maxRunsMonth: number;
  maxExportsMonth: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  starter: {
    maxSeats: 1,
    maxProjects: 3,
    maxUploadsMonth: 20,
    maxRunsMonth: 5,
    maxExportsMonth: 10,
  },
  growth: {
    maxSeats: 5,
    maxProjects: 15,
    maxUploadsMonth: 100,
    maxRunsMonth: 30,
    maxExportsMonth: 50,
  },
  pro: {
    maxSeats: 25,
    maxProjects: 100,
    maxUploadsMonth: 500,
    maxRunsMonth: 200,
    maxExportsMonth: 200,
  },
};

function toPlanKey(plan: string): PlanKey {
  if (plan === "growth" || plan === "pro") return plan;
  return "starter";
}

// ─── Entitlement check result ────────────────────────────────────────────────

export type EntitlementResult =
  | { allowed: true }
  | { allowed: false; reason: string };

// ─── BillingModel ────────────────────────────────────────────────────────────

export const BillingModel = {
  // ── Stripe customer ──────────────────────────────────────────────────────

  async findCustomerByFirmId(firmId: string) {
    return db.billingCustomer.findUnique({
      where: { firmId },
      include: { subscription: true },
    });
  },

  async findCustomerByStripeId(stripeCustomerId: string) {
    return db.billingCustomer.findUnique({
      where: { stripeCustomerId },
      include: { subscription: true },
    });
  },

  async upsertCustomer(input: {
    firmId: string;
    stripeCustomerId: string;
    billingEmail?: string | null;
  }) {
    return db.billingCustomer.upsert({
      where: { firmId: input.firmId },
      create: {
        firmId: input.firmId,
        stripeCustomerId: input.stripeCustomerId,
        billingEmail: input.billingEmail ?? null,
      },
      update: {
        stripeCustomerId: input.stripeCustomerId,
        billingEmail: input.billingEmail ?? undefined,
      },
    });
  },

  // ── Subscription ─────────────────────────────────────────────────────────

  async upsertSubscription(input: {
    billingCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    status: SubscriptionStatus;
    interval: BillingInterval;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date | null;
    trialEnd?: Date | null;
  }) {
    return db.subscription.upsert({
      where: { billingCustomerId: input.billingCustomerId },
      create: {
        billingCustomerId: input.billingCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId,
        status: input.status,
        interval: input.interval,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        canceledAt: input.canceledAt ?? null,
        trialEnd: input.trialEnd ?? null,
      },
      update: {
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId,
        status: input.status,
        interval: input.interval,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        canceledAt: input.canceledAt ?? null,
        trialEnd: input.trialEnd ?? null,
      },
    });
  },

  // ── Plan entitlements ─────────────────────────────────────────────────────

  async upsertEntitlement(firmId: string, plan: string) {
    const limits = PLAN_LIMITS[toPlanKey(plan)];
    return db.planEntitlement.upsert({
      where: { firmId },
      create: { firmId, ...limits },
      update: limits,
    });
  },

  async getEntitlement(firmId: string) {
    return db.planEntitlement.findUnique({ where: { firmId } });
  },

  // ── Usage meters ──────────────────────────────────────────────────────────

  async getOrCreateUsageMeter(firmId: string): Promise<{
    id: string;
    firmId: string;
    periodStart: Date;
    uploadsCount: number;
    runsCount: number;
    exportsCount: number;
  }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const existing = await db.usageMeter.findUnique({ where: { firmId } });

    // Reset if we've rolled into a new billing period
    if (existing && existing.periodStart < periodStart) {
      return db.usageMeter.update({
        where: { firmId },
        data: {
          periodStart,
          uploadsCount: 0,
          runsCount: 0,
          exportsCount: 0,
        },
      });
    }

    if (existing) return existing;

    return db.usageMeter.create({
      data: { firmId, periodStart, uploadsCount: 0, runsCount: 0, exportsCount: 0 },
    });
  },

  async incrementUploads(firmId: string) {
    await this.getOrCreateUsageMeter(firmId);
    return db.usageMeter.update({
      where: { firmId },
      data: { uploadsCount: { increment: 1 } },
    });
  },

  async incrementRuns(firmId: string) {
    await this.getOrCreateUsageMeter(firmId);
    return db.usageMeter.update({
      where: { firmId },
      data: { runsCount: { increment: 1 } },
    });
  },

  async incrementExports(firmId: string) {
    await this.getOrCreateUsageMeter(firmId);
    return db.usageMeter.update({
      where: { firmId },
      data: { exportsCount: { increment: 1 } },
    });
  },

  // ── Invoice events (idempotent) ───────────────────────────────────────────

  async recordInvoiceEvent(input: {
    firmId?: string | null;
    stripeEventId: string;
    eventType: string;
    payload: object;
  }): Promise<{ isNew: boolean }> {
    const existing = await db.invoiceEvent.findUnique({
      where: { stripeEventId: input.stripeEventId },
      select: { id: true },
    });

    if (existing) {
      return { isNew: false };
    }

    await db.invoiceEvent.create({
      data: {
        firmId: input.firmId ?? null,
        stripeEventId: input.stripeEventId,
        eventType: input.eventType,
        payload: input.payload as Parameters<typeof db.invoiceEvent.create>[0]["data"]["payload"],
      },
    });

    return { isNew: true };
  },

  // ── Entitlement checks ────────────────────────────────────────────────────

  async checkProjectCreation(firmId: string): Promise<EntitlementResult> {
    const [entitlement, projectCount] = await Promise.all([
      this.getEntitlement(firmId),
      db.project.count({ where: { firmId } }),
    ]);

    const limit = entitlement?.maxProjects ?? PLAN_LIMITS.starter.maxProjects;
    if (projectCount >= limit) {
      return {
        allowed: false,
        reason: `Your plan allows up to ${limit} project${limit === 1 ? "" : "s"}. Upgrade to create more.`,
      };
    }

    return { allowed: true };
  },

  async checkUpload(firmId: string): Promise<EntitlementResult> {
    const [entitlement, meter] = await Promise.all([
      this.getEntitlement(firmId),
      this.getOrCreateUsageMeter(firmId),
    ]);

    const limit = entitlement?.maxUploadsMonth ?? PLAN_LIMITS.starter.maxUploadsMonth;
    if (meter.uploadsCount >= limit) {
      return {
        allowed: false,
        reason: `You've reached your monthly upload limit of ${limit}. Upgrade or wait until next month.`,
      };
    }

    return { allowed: true };
  },

  async checkWorkflowRun(firmId: string): Promise<EntitlementResult> {
    const [entitlement, meter] = await Promise.all([
      this.getEntitlement(firmId),
      this.getOrCreateUsageMeter(firmId),
    ]);

    const limit = entitlement?.maxRunsMonth ?? PLAN_LIMITS.starter.maxRunsMonth;
    if (meter.runsCount >= limit) {
      return {
        allowed: false,
        reason: `You've reached your monthly diligence run limit of ${limit}. Upgrade or wait until next month.`,
      };
    }

    return { allowed: true };
  },

  async checkExport(firmId: string): Promise<EntitlementResult> {
    const [entitlement, meter] = await Promise.all([
      this.getEntitlement(firmId),
      this.getOrCreateUsageMeter(firmId),
    ]);

    const limit = entitlement?.maxExportsMonth ?? PLAN_LIMITS.starter.maxExportsMonth;
    if (meter.exportsCount >= limit) {
      return {
        allowed: false,
        reason: `You've reached your monthly export limit of ${limit}. Upgrade or wait until next month.`,
      };
    }

    return { allowed: true };
  },

  async checkSeatAvailability(firmId: string): Promise<EntitlementResult> {
    const [entitlement, seatCount] = await Promise.all([
      this.getEntitlement(firmId),
      db.firmMembership.count({
        where: { firmId, status: "ACTIVE" },
      }),
    ]);

    const limit = entitlement?.maxSeats ?? PLAN_LIMITS.starter.maxSeats;
    if (seatCount >= limit) {
      return {
        allowed: false,
        reason: `Your plan allows up to ${limit} seat${limit === 1 ? "" : "s"}. Upgrade to invite more members.`,
      };
    }

    return { allowed: true };
  },
};
