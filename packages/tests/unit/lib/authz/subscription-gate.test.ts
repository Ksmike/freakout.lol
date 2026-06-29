import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
  getActiveFirmSummaryForUser: vi.fn(),
  findCustomerByFirmId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: mocks.isStripeConfigured,
}));

vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    getActiveFirmSummaryForUser: mocks.getActiveFirmSummaryForUser,
  },
}));

vi.mock("@/lib/models/BillingModel", () => ({
  BillingModel: {
    findCustomerByFirmId: mocks.findCustomerByFirmId,
  },
}));

const { checkSubscriptionAccess } = await import(
  "@/lib/authz/subscription-gate"
);

describe("checkSubscriptionAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isStripeConfigured.mockReturnValue(true);
  });

  it("allows access when Stripe is not configured", async () => {
    mocks.isStripeConfigured.mockReturnValue(false);

    await expect(checkSubscriptionAccess("USER")).resolves.toEqual({
      hasAccess: true,
    });
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("checks billing when Stripe is configured", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      plan: "starter",
      billingStatus: "trialing",
    });
    mocks.findCustomerByFirmId.mockResolvedValue(null);

    await expect(checkSubscriptionAccess("USER")).resolves.toEqual({
      hasAccess: false,
      firmId: "firm-1",
      plan: "starter",
      billingStatus: "trialing",
    });
  });
});
