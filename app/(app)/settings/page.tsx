import { FiKey, FiShield } from "react-icons/fi";
import { getApiKeyStatuses } from "@/lib/actions/apiKeys";
import { ApiKeySection } from "@/components/settings/ApiKeySection";

export const metadata = {
  title: "Settings | KG Qualify",
};

export default async function SettingsPage() {
  const apiKeyStatuses = await getApiKeyStatuses();

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl overflow-x-hidden">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1.5 text-sm text-foreground/60">
          Manage your workspace preferences.
        </p>
      </div>

      {/* API Keys section */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FiKey className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Provider Keys</h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              Bring your own API keys to power AI features. Keys are encrypted
              at rest with AES-256 and never returned to the browser.
            </p>
          </div>
        </div>

        <ApiKeySection initial={apiKeyStatuses} />

        {/* Encryption note */}
        <div className="mt-4 flex items-center gap-2 text-xs text-foreground/40">
          <FiShield className="h-3.5 w-3.5 shrink-0" />
          <span>
            Keys are stored encrypted. Only you can use them — they are never
            shared or logged.
          </span>
        </div>
      </section>
    </div>
  );
}
