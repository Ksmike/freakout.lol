import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    customers: {
      create: vi.fn(),
    },
    products: {
      retrieve: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
    },
  },
  billingModel: {
    findCustomerByFirmId: vi.fn(),
    getEntitlement: vi.fn(),
    getOrCreateUsageMeter: vi.fn(),
    upsertCustomer: vi.fn(),
    upsertEntitlement: vi.fn(),
    upsertSubscription: vi.fn(),
    updateSubscriptionCancellation: vi.fn(),
  },
  firmModel: {
    getActiveFirmSummaryForUser: vi.fn(),
  },
  db: {
    firm: {
      update: vi.fn(),
    },
  },
  auditLogModel: {
    record: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: mocks.stripe,
}));

vi.mock("@/lib/models/BillingModel", () => {
  return {
    BillingModel: mocks.billingModel,
  };
});

vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: mocks.firmModel,
}));

vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: mocks.auditLogModel,
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

const {
  cancelSubscriptionAtPeriodEnd,
  createCheckoutSession,
  createPortalSession,
  createSeatCheckoutSession,
  syncCheckoutSession,
} = await import("@/lib/actions/billing");

describe("billing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.com" },
    });
    mocks.firmModel.getActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      name: "Acme",
      plan: "starter",
      billingStatus: "trialing",
    });
    mocks.headers.mockResolvedValue(
      new Headers({
        host: "dd-qualify.vercel.app",
        "x-forwarded-proto": "https",
      })
    );
  });

  it("uses the request origin and checkout session id in Stripe return URLs", async () => {
    mocks.billingModel.findCustomerByFirmId.mockResolvedValue({
      id: "billing-customer-1",
      stripeCustomerId: "cus_1",
    });
    mocks.stripe.checkout.sessions.create.mockResolvedValue({
      url: "https://stripe.example/checkout",
    });

    await expect(createCheckoutSession("price_growth")).rejects.toThrow(
      "REDIRECT:https://stripe.example/checkout"
    );

    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          "https://dd-qualify.vercel.app/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://dd-qualify.vercel.app/settings/billing?billing=canceled",
      })
    );
  });

  it("enables promotion codes for seat checkout sessions", async () => {
    vi.stubEnv("STRIPE_SEAT_PRICE_ID", "price_seat");
    mocks.billingModel.findCustomerByFirmId.mockResolvedValue({
      id: "billing-customer-1",
      stripeCustomerId: "cus_1",
    });
    mocks.stripe.checkout.sessions.create.mockResolvedValue({
      url: "https://stripe.example/checkout",
    });

    await expect(createSeatCheckoutSession()).rejects.toThrow(
      "REDIRECT:https://stripe.example/checkout"
    );

    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_promotion_codes: true,
        line_items: [{ price: "price_seat", quantity: 1 }],
      })
    );
  });

  it("uses the request origin for Stripe portal return URL", async () => {
    mocks.billingModel.findCustomerByFirmId.mockResolvedValue({
      id: "billing-customer-1",
      stripeCustomerId: "cus_1",
    });
    mocks.stripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test",
    });

    await expect(createPortalSession()).rejects.toThrow(
      "REDIRECT:https://billing.stripe.com/p/session/test"
    );

    expect(mocks.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://dd-qualify.vercel.app/settings/billing",
    });
  });

  it("syncs a successful checkout subscription into local billing state", async () => {
    mocks.billingModel.findCustomerByFirmId.mockResolvedValue({
      id: "billing-customer-1",
      stripeCustomerId: "cus_1",
    });
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_1",
      mode: "subscription",
      metadata: { firmId: "firm-1" },
      customer: "cus_1",
      subscription: {
        id: "sub_1",
        status: "active",
        current_period_start: 1_800_000_000,
        current_period_end: 1_802_592_000,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
        items: {
          data: [
            {
              price: {
                id: "price_growth",
                metadata: { plan: "growth" },
                recurring: { interval: "month" },
                product: "prod_1",
              },
            },
          ],
        },
      },
    });

    const result = await syncCheckoutSession("cs_1");

    expect(result).toEqual({
      status: "synced",
      plan: "growth",
      subscriptionStatus: "active",
    });
    expect(mocks.billingModel.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        billingCustomerId: "billing-customer-1",
        interval: "MONTHLY",
        status: "ACTIVE",
        stripePriceId: "price_growth",
        stripeSubscriptionId: "sub_1",
      })
    );
    expect(mocks.db.firm.update).toHaveBeenCalledWith({
      where: { id: "firm-1" },
      data: {
        plan: "growth",
        billingStatus: "active",
      },
    });
    expect(mocks.billingModel.upsertEntitlement).toHaveBeenCalledWith(
      "firm-1",
      "growth"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/billing");
  });

  it("schedules subscription cancellation at period end", async () => {
    mocks.billingModel.findCustomerByFirmId.mockResolvedValue({
      id: "billing-customer-1",
      stripeCustomerId: "cus_1",
      subscription: {
        stripeSubscriptionId: "sub_1",
        cancelAtPeriodEnd: false,
      },
    });
    mocks.stripe.subscriptions.update.mockResolvedValue({
      id: "sub_1",
      status: "active",
      current_period_end: 1_802_592_000,
      cancel_at_period_end: true,
      canceled_at: null,
    });

    const result = await cancelSubscriptionAtPeriodEnd();

    expect(result).toEqual({});
    expect(mocks.stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });
    expect(
      mocks.billingModel.updateSubscriptionCancellation
    ).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      currentPeriodEnd: new Date(1_802_592_000 * 1000),
      cancelAtPeriodEnd: true,
      canceledAt: null,
    });
    expect(mocks.db.firm.update).toHaveBeenCalledWith({
      where: { id: "firm-1" },
      data: { billingStatus: "active" },
    });
    expect(mocks.auditLogModel.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BILLING_SUBSCRIPTION_CANCELED",
        targetId: "sub_1",
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/billing");
  });

  it("rejects checkout sessions for another firm", async () => {
    mocks.stripe.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_1",
      mode: "subscription",
      metadata: { firmId: "firm-2" },
    });

    const result = await syncCheckoutSession("cs_1");

    expect(result.status).toBe("error");
    expect(mocks.billingModel.upsertSubscription).not.toHaveBeenCalled();
    expect(mocks.db.firm.update).not.toHaveBeenCalled();
  });
});
