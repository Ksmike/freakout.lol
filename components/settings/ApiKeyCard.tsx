"use client";

import { useState, useTransition } from "react";
import { SiAnthropic, SiGoogle, SiOpenai } from "react-icons/si";
import { LuServer } from "react-icons/lu";
import { FiAlertCircle, FiEdit2, FiLoader, FiTrash2, FiX } from "react-icons/fi";
import {
  deleteApiKey,
  updateApiKeySettings,
  upsertApiKey,
  validateApiKey,
} from "@/lib/actions/apiKeys";
import type { ApiKeyStatus } from "@/lib/actions/apiKeys";
import {
  normalizeLocalLlmBaseUrl,
  serializeLocalLlmConnectorConfig,
} from "@/lib/diligence/local-llm";
import type { ApiKeyProvider } from "@/lib/generated/prisma/client";
import type { IconType } from "react-icons";

type ProviderLabels = {
  name: string;
  description: string;
  placeholder: string;
};

export type ApiKeyConnectorLabels = {
  providers: Record<ApiKeyProvider, ProviderLabels>;
  connectedStatus: string;
  notConfiguredStatus: string;
  updateCredentialTitle: string;
  revokeCredentialTitle: string;
  cancelTitle: string;
  pasteNewCredentialPlaceholder: string;
  localEndpointLabel: string;
  localEndpointPlaceholder: string;
  localApiKeyLabel: string;
  localApiKeyPlaceholder: string;
  localApiKeyHint: string;
  localEndpointInvalid: string;
  defaultModelLabel: string;
  enabledLabel: string;
  saveSettingsCta: string;
  saveCta: string;
  savingCta: string;
  updateCta: string;
  testConnectionCta: string;
  testingConnectionCta: string;
};

type ProviderMeta = {
  Icon: IconType;
  iconColor: string;
  iconBg: string;
};

const PROVIDER_META: Record<ApiKeyProvider, ProviderMeta> = {
  OPENAI: {
    Icon: SiOpenai,
    iconColor: "text-success",
    iconBg: "bg-success/10",
  },
  ANTHROPIC: {
    Icon: SiAnthropic,
    iconColor: "text-warning",
    iconBg: "bg-warning/10",
  },
  GOOGLE: {
    Icon: SiGoogle,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  LOCAL: {
    Icon: LuServer,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
  },
};

type Mode = "idle" | "editing";

function isLocalProvider(provider: ApiKeyProvider): boolean {
  return provider === "LOCAL";
}

export function ApiKeyCard({
  initial,
  labels,
  onUpdate,
}: {
  initial: ApiKeyStatus;
  labels: ApiKeyConnectorLabels;
  onUpdate: (updated: ApiKeyStatus) => void;
}) {
  const { provider } = initial;
  const meta = PROVIDER_META[provider];
  const providerLabels = labels.providers[provider];
  const { Icon, iconColor, iconBg } = meta;
  const isLocal = isLocalProvider(provider);

  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode>("idle");
  const [inputValue, setInputValue] = useState("");
  const [localBaseUrl, setLocalBaseUrl] = useState(initial.connectorUrl ?? "");
  const [localApiKey, setLocalApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel ?? "");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function buildCredentialInput(): {
    credential: string;
    connectorUrl: string | null;
  } | null {
    if (!isLocal) {
      const trimmed = inputValue.trim();
      return trimmed ? { credential: trimmed, connectorUrl: null } : null;
    }

    const connectorUrl = normalizeLocalLlmBaseUrl(localBaseUrl);
    if (!connectorUrl) {
      return null;
    }

    return {
      credential: serializeLocalLlmConnectorConfig({
        baseUrl: connectorUrl,
        apiKey: localApiKey,
      }),
      connectorUrl,
    };
  }

  function hasCredentialInput(): boolean {
    return isLocal ? !!localBaseUrl.trim() : !!inputValue.trim();
  }

  function resetCredentialInputs(nextConnectorUrl?: string | null) {
    setInputValue("");
    setLocalApiKey("");
    setLocalBaseUrl(nextConnectorUrl ?? "");
  }

  function handleSave() {
    const credentialInput = buildCredentialInput();
    if (!credentialInput) {
      if (isLocal) {
        setError(labels.localEndpointInvalid);
      }
      return;
    }

    setError("");
    startTransition(async () => {
      const shouldEnable = status.isSet ? enabled : true;
      const result = await upsertApiKey(provider, credentialInput.credential, {
        defaultModel,
        enabled: shouldEnable,
      });
      if (result.error) {
        setError(result.error);
        return;
      }

      const updated: ApiKeyStatus = {
        id: status.id,
        provider,
        isSet: true,
        hint: isLocal
          ? credentialInput.connectorUrl
          : credentialInput.credential.slice(-4),
        connectorUrl: credentialInput.connectorUrl,
        defaultModel,
        enabled: shouldEnable,
        lastValidatedAt: status.lastValidatedAt,
      };
      setStatus(updated);
      onUpdate(updated);
      resetCredentialInputs(credentialInput.connectorUrl);
      setMode("idle");
      setEnabled(shouldEnable);
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      await deleteApiKey(provider);
      const updated: ApiKeyStatus = {
        id: null,
        provider,
        isSet: false,
        hint: null,
        connectorUrl: null,
        defaultModel,
        enabled: false,
        lastValidatedAt: null,
      };
      setStatus(updated);
      onUpdate(updated);
      setMode("idle");
      resetCredentialInputs(null);
    });
  }

  async function handleTestKey() {
    const credentialInput = buildCredentialInput();
    if (!credentialInput) {
      if (isLocal) {
        setError(labels.localEndpointInvalid);
      }
      return;
    }

    setError("");
    setIsValidating(true);
    try {
      const result = await validateApiKey(
        provider,
        credentialInput.credential,
        defaultModel
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus((currentStatus) => ({
        ...currentStatus,
        lastValidatedAt: result.validatedAt ?? currentStatus.lastValidatedAt,
      }));
    } finally {
      setIsValidating(false);
    }
  }

  function handleSaveSettings() {
    startTransition(async () => {
      const result = await updateApiKeySettings(provider, {
        enabled,
        defaultModel,
      });
      if (result.error) {
        setError(result.error);
        return;
      }

      const updated: ApiKeyStatus = {
        ...status,
        enabled,
        defaultModel,
      };
      setStatus(updated);
      onUpdate(updated);
    });
  }

  function handleCancel() {
    setMode("idle");
    resetCredentialInputs(status.connectorUrl);
    setError("");
  }

  const showInput = !status.isSet || mode === "editing";
  const credentialHint = isLocal
    ? status.connectorUrl ?? status.hint
    : status.hint
      ? `................${status.hint}`
      : null;

  return (
    <div className="rounded-xl border border-divider bg-content1 transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:flex-1">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {providerLabels.name}
            </p>
            <p className="text-xs leading-snug text-foreground/50">
              {providerLabels.description}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
          {status.isSet ? (
            <>
              <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {labels.connectedStatus}
              </span>
              {mode === "idle" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode("editing")}
                    disabled={isPending}
                    title={labels.updateCredentialTitle}
                    aria-label={labels.updateCredentialTitle}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-content2 hover:text-foreground disabled:opacity-40"
                  >
                    <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={isPending}
                    title={labels.revokeCredentialTitle}
                    aria-label={labels.revokeCredentialTitle}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/40 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                  >
                    {isPending ? (
                      <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-content2 px-2.5 py-0.5 text-xs font-medium text-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
              {labels.notConfiguredStatus}
            </span>
          )}
        </div>
      </div>

      {status.isSet && credentialHint && mode === "idle" && (
        <div className="border-t border-divider px-5 py-2.5">
          <p className="font-mono text-xs text-foreground/40 tracking-wider">
            {credentialHint}
          </p>
        </div>
      )}

      {showInput && (
        <div className="border-t border-divider p-4 pt-4 sm:p-5 sm:pt-4">
          <div className="flex flex-col gap-2">
            {isLocal ? (
              <>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
                  <label className="block">
                    <span className="text-xs text-foreground/60">
                      {labels.localEndpointLabel}
                    </span>
                    <input
                      type="url"
                      value={localBaseUrl}
                      onChange={(e) => {
                        setLocalBaseUrl(e.target.value);
                        if (error) setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                      placeholder={labels.localEndpointPlaceholder}
                      autoComplete="off"
                      className="mt-1 w-full min-w-0 rounded-md border border-divider bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-foreground/60">
                      {labels.localApiKeyLabel}
                    </span>
                    <input
                      type="password"
                      value={localApiKey}
                      onChange={(e) => {
                        setLocalApiKey(e.target.value);
                        if (error) setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                      placeholder={labels.localApiKeyPlaceholder}
                      autoComplete="off"
                      className="mt-1 w-full min-w-0 rounded-md border border-divider bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-foreground/60">
                    {labels.defaultModelLabel}
                  </span>
                  <input
                    value={defaultModel}
                    onChange={(event) => setDefaultModel(event.target.value)}
                    placeholder="llama3.1"
                    className="mt-1 w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </>
            ) : (
              <input
                type="password"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={
                  mode === "editing"
                    ? labels.pasteNewCredentialPlaceholder
                    : providerLabels.placeholder
                }
                autoComplete="off"
                className="w-full min-w-0 rounded-md border border-divider bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}

            {isLocal && (
              <p className="text-xs text-foreground/50">
                {labels.localApiKeyHint}
              </p>
            )}

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !hasCredentialInput()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                {isPending && <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isPending
                  ? labels.savingCta
                  : status.isSet
                    ? labels.updateCta
                    : labels.saveCta}
              </button>
              <button
                type="button"
                onClick={() => void handleTestKey()}
                disabled={isValidating || !hasCredentialInput()}
                className="flex-1 rounded-md border border-divider px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-content2 disabled:opacity-40 sm:flex-none"
              >
                {isValidating
                  ? labels.testingConnectionCta
                  : labels.testConnectionCta}
              </button>
              {mode === "editing" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  title={labels.cancelTitle}
                  aria-label={labels.cancelTitle}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-divider text-foreground/50 transition-colors hover:bg-content2 hover:text-foreground disabled:opacity-50"
                >
                  <FiX className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
              <FiAlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      )}

      {status.isSet && mode === "idle" && (
        <div className="space-y-3 border-t border-divider p-4 pt-4 sm:p-5 sm:pt-4">
          <label className="block">
            <span className="text-xs text-foreground/60">
              {labels.defaultModelLabel}
            </span>
            <input
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              className="mt-1 w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {labels.enabledLabel}
          </label>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isPending}
            className="w-full rounded-md border border-divider px-3 py-2 text-xs font-medium text-foreground hover:bg-content2 disabled:opacity-50 sm:w-auto sm:py-1.5"
          >
            {labels.saveSettingsCta}
          </button>
        </div>
      )}
    </div>
  );
}
