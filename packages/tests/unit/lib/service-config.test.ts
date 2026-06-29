import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailConfigured } from "@/lib/email";
import { getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe";

describe("optional service configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats missing and placeholder email keys as unconfigured", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isEmailConfigured()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "replace-with-resend-api-key");
    expect(isEmailConfigured()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "configured-value");
    expect(isEmailConfigured()).toBe(true);
  });

  it("requires Stripe secret and seat price for visible billing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "configured-secret");
    vi.stubEnv("STRIPE_SEAT_PRICE_ID", "");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_SEAT_PRICE_ID", "");
    expect(isStripeConfigured()).toBe(false);

    vi.stubEnv("STRIPE_SEAT_PRICE_ID", "replace-with-stripe-seat-price-id");
    expect(isStripeConfigured()).toBe(false);

    vi.stubEnv("STRIPE_SEAT_PRICE_ID", "configured-price");
    expect(isStripeConfigured()).toBe(true);
  });

  it("rejects placeholder Stripe webhook secrets", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "replace-with-stripe-webhook-secret");

    expect(() => getStripeWebhookSecret()).toThrow(
      "STRIPE_WEBHOOK_SECRET is not configured."
    );
  });
});
