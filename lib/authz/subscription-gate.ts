import { auth } from "@/lib/auth";
import { FirmModel } from "@/lib/models/FirmModel";
import { BillingModel } from "@/lib/models/BillingModel";
import { isStripeConfigured } from "@/lib/stripe";

export type SubscriptionAccess =
  | { hasAccess: true }
  | { hasAccess: false; firmId: string; plan: string; billingStatus: string };

/**
 * Checks whether the current user's firm has an active paid subscription.
 * "Active" means the firm has a subscription with status ACTIVE or TRIALING.
 *
 * Free users (starter plan with no active subscription) get `hasAccess: false`.
 * Platform admins always get access.
 */
export async function checkSubscriptionAccess(
  systemRole?: string | null
): Promise<SubscriptionAccess> {
  // Platform admins bypass the paywall
  if (systemRole === "ADMIN") {
    return { hasAccess: true };
  }

  if (!isStripeConfigured()) {
    return { hasAccess: true };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { hasAccess: false, firmId: "", plan: "starter", billingStatus: "trialing" };
  }

  const firm = await FirmModel.getActiveFirmSummaryForUser(session.user.id);

  // Check if the firm has an active subscription
  const customer = await BillingModel.findCustomerByFirmId(firm.firmId);
  const subscriptionStatus = customer?.subscription?.status;

  const isActive =
    subscriptionStatus === "ACTIVE" ||
    subscriptionStatus === "TRIALING";

  if (isActive) {
    return { hasAccess: true };
  }

  return {
    hasAccess: false,
    firmId: firm.firmId,
    plan: firm.plan,
    billingStatus: firm.billingStatus,
  };
}
