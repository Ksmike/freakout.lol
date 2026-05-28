import { ApiKeyProvider } from "@/lib/generated/prisma/client";

export type RoutedUserApiKey = {
  id: string;
  provider: ApiKeyProvider;
  defaultModel: string | null;
  enabled: boolean;
};

export type ModelRouteRequest = {
  selectedProvider?: ApiKeyProvider | null;
  selectedModel?: string | null;
  fallbackProviders?: ApiKeyProvider[] | null;
  keys: RoutedUserApiKey[];
};

export type ModelRoute = {
  userApiKeyId: string;
  selectedProvider: ApiKeyProvider;
  selectedModel: string;
  fallbackProviders: ApiKeyProvider[];
};

const PROVIDER_DEFAULT_MODELS: Record<ApiKeyProvider, string> = {
  OPENAI: "gpt-4o-mini",
  ANTHROPIC: "claude-3-5-sonnet-latest",
  GOOGLE: "gemini-2.5-flash",
  LOCAL: "llama3.1",
};

export const MODEL_PROVIDER_ORDER: ApiKeyProvider[] = [
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  "LOCAL",
];

export class ModelRouter {
  route(input: ModelRouteRequest): ModelRoute {
    const enabledKeys = input.keys.filter((key) => key.enabled);
    if (enabledKeys.length === 0) {
      throw new Error("No enabled provider keys are configured.");
    }

    const keyByProvider = new Map(
      enabledKeys.map((key) => [key.provider, key] as const)
    );
    const requestedProvider = input.selectedProvider ?? enabledKeys[0].provider;
    const selectedKey =
      keyByProvider.get(requestedProvider) ??
      keyByProvider.get(enabledKeys[0].provider);

    if (!selectedKey) {
      throw new Error("Unable to resolve selected provider key.");
    }

    const selectedModel =
      input.selectedModel?.trim() ||
      selectedKey.defaultModel ||
      PROVIDER_DEFAULT_MODELS[selectedKey.provider];

    const requestedFallbacks = input.fallbackProviders ?? [];
    const dedupedFallbacks = requestedFallbacks
      .filter((provider) => provider !== selectedKey.provider)
      .filter((provider, index, values) => values.indexOf(provider) === index)
      .filter((provider) => keyByProvider.has(provider));

    const implicitFallbacks = enabledKeys
      .map((key) => key.provider)
      .filter((provider) => provider !== selectedKey.provider)
      .filter((provider) => !dedupedFallbacks.includes(provider));

    return {
      userApiKeyId: selectedKey.id,
      selectedProvider: selectedKey.provider,
      selectedModel,
      fallbackProviders: [...dedupedFallbacks, ...implicitFallbacks],
    };
  }
}

export function defaultModelForProvider(provider: ApiKeyProvider): string {
  return PROVIDER_DEFAULT_MODELS[provider];
}
