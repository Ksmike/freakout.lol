import { SettingsNav } from "./SettingsNav";
import { getLabelsForLocale } from "@/labels";
import { isStripeConfigured } from "@/lib/stripe";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { labels } = getLabelsForLocale("en");
  const t = labels.app.settings;
  const showBilling = isStripeConfigured();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.heading}</h1>
        <p className="mt-1.5 text-sm text-foreground/60">{t.description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-6 md:flex-row">
        <SettingsNav labels={t} showBilling={showBilling} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
