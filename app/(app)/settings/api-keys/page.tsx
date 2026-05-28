import { LuKey, LuShield } from "react-icons/lu";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { getApiKeyStatuses } from "@/lib/actions/apiKeys";
import { getLabelsForLocale } from "@/labels";

export const metadata = {
  title: "AI Connectors | Freakout.lol",
};

export default async function ApiKeysSettingsPage() {
  const { labels } = getLabelsForLocale("en");
  const apiKeyStatuses = await getApiKeyStatuses();
  const t = labels.app.settings;

  return (
    <div className="max-w-3xl">
      <SettingsSectionHeader
        icon={<LuKey className="h-4 w-4" aria-hidden="true" />}
        title={t.apiKeysHeading}
        description={t.apiKeysDescription}
      />

      <ApiKeySection
        initial={apiKeyStatuses}
        labels={t.apiKeyConnectors}
      />

      <div className="mt-4 flex items-center gap-2 text-xs text-foreground/40">
        <LuShield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.encryptionNote}</span>
      </div>
    </div>
  );
}
