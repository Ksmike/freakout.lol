import { redirect } from "next/navigation";
import { isStripeConfigured } from "@/lib/stripe";

type SettingsIndexPageProps = {
  searchParams: Promise<{
    billing?: string | string[];
    session_id?: string | string[];
  }>;
};

export default async function SettingsIndexPage({
  searchParams,
}: SettingsIndexPageProps) {
  const params = await searchParams;
  const billing = getSearchParam(params.billing);
  const checkoutSessionId = getSearchParam(params.session_id);

  if (billing && isStripeConfigured()) {
    const query = new URLSearchParams({ billing });
    if (checkoutSessionId) query.set("session_id", checkoutSessionId);
    redirect(`/settings/billing?${query.toString()}`);
  }

  redirect("/settings/account");
}

function getSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
