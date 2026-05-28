"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiKeyProvider } from "@/lib/generated/prisma/client";
import {
  getLocalLlmConnectorHint,
  parseLocalLlmConnectorConfig,
  serializeLocalLlmConnectorConfig,
} from "@/lib/diligence/local-llm";
import { ModelProviderRegistry } from "@/lib/diligence/model-provider";
import {
  MODEL_PROVIDER_ORDER,
  defaultModelForProvider,
} from "@/lib/diligence/model-router";
import { UserApiKeyModel } from "@/lib/models/UserApiKeyModel";

export type ApiKeyStatus = {
  id: string | null;
  provider: ApiKeyProvider;
  isSet: boolean;
  hint: string | null;
  connectorUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  lastValidatedAt: string | null;
};

const PROVIDERS = MODEL_PROVIDER_ORDER;

/**
 * Validates the format/prefix of an API key for a given provider.
 * Returns an error message if invalid, or null if the format looks correct.
 */
function validateKeyFormat(provider: ApiKeyProvider, key: string): string | null {
  switch (provider) {
    case "OPENAI":
      // OpenAI keys start with "sk-" and are typically 40-200 chars
      if (!key.startsWith("sk-")) {
        return "OpenAI keys must start with \"sk-\". Check that you copied the full key.";
      }
      if (key.length < 20) {
        return "This OpenAI key looks too short. Keys are typically 50+ characters.";
      }
      return null;

    case "ANTHROPIC":
      // Anthropic keys start with "sk-ant-"
      if (!key.startsWith("sk-ant-")) {
        return "Anthropic keys must start with \"sk-ant-\". Check that you copied the full key.";
      }
      if (key.length < 30) {
        return "This Anthropic key looks too short. Keys are typically 90+ characters.";
      }
      return null;

    case "GOOGLE":
      // Google AI keys start with "AIzaSy"
      if (!key.startsWith("AIzaSy")) {
        return "Google AI keys must start with \"AIzaSy\". Check that you copied the full key.";
      }
      if (key.length < 30) {
        return "This Google AI key looks too short. Keys are typically 39 characters.";
      }
      return null;

    case "LOCAL":
      if (!parseLocalLlmConnectorConfig(key)) {
        return "Enter a valid HTTP(S) OpenAI-compatible local LLM endpoint URL.";
      }
      return null;

    default:
      return null;
  }
}

function buildCredentialForStorage(
  provider: ApiKeyProvider,
  rawCredential: string
): { storedCredential: string; keyHint: string; connectorUrl: string | null } {
  if (provider !== "LOCAL") {
    return {
      storedCredential: rawCredential,
      keyHint: rawCredential.slice(-4),
      connectorUrl: null,
    };
  }

  const connector = parseLocalLlmConnectorConfig(rawCredential);
  if (!connector) {
    throw new Error("Invalid local LLM connector.");
  }

  return {
    storedCredential: serializeLocalLlmConnectorConfig(connector),
    keyHint: "local",
    connectorUrl: connector.baseUrl,
  };
}

function getConnectorUrlForStatus(input: {
  provider: ApiKeyProvider;
  encryptedKey?: string;
}): string | null {
  if (input.provider !== "LOCAL" || !input.encryptedKey) {
    return null;
  }

  try {
    return parseLocalLlmConnectorConfig(
      UserApiKeyModel.decryptApiKey(input.encryptedKey)
    )?.baseUrl ?? null;
  } catch {
    return null;
  }
}

export async function getApiKeyStatuses(): Promise<ApiKeyStatus[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return PROVIDERS.map((provider) => ({
      id: null,
      provider,
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: defaultModelForProvider(provider),
      enabled: false,
      lastValidatedAt: null,
    }));
  }

  const keys = await UserApiKeyModel.listForUser(session.user.id);

  return PROVIDERS.map((provider) => {
    const key = keys.find((k) => k.provider === provider);
    const connectorUrl = getConnectorUrlForStatus({
      provider,
      encryptedKey: key?.encryptedKey,
    });
    return {
      id: key?.id ?? null,
      provider,
      isSet: !!key,
      hint:
        provider === "LOCAL" && connectorUrl
          ? getLocalLlmConnectorHint(connectorUrl)
          : key?.keyHint ?? null,
      connectorUrl,
      defaultModel: key?.defaultModel ?? defaultModelForProvider(provider),
      enabled: key?.enabled ?? false,
      lastValidatedAt: key?.lastValidatedAt?.toISOString() ?? null,
    };
  });
}

async function pingProviderKey(input: {
  provider: ApiKeyProvider;
  apiKey: string;
  model: string;
}): Promise<{ isValid: boolean; error?: string }> {
  try {
    const providers = new ModelProviderRegistry();
    const modelProvider = providers.getProvider(input.provider);
    const model = modelProvider.createChatModel({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      temperature: 0,
      maxRetries: 1,
    });
    await model.invoke(
      "Respond with exactly one word: OK. Do not include punctuation."
    );
    return { isValid: true };
  } catch {
    return { isValid: false, error: "Provider rejected the key or model." };
  }
}

export async function validateApiKey(
  provider: ApiKeyProvider,
  rawKey: string,
  requestedModel?: string
): Promise<{ error?: string; validatedAt?: string; modelUsed?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!PROVIDERS.includes(provider)) return { error: "Invalid provider" };

  const trimmed = rawKey.trim();
  if (!trimmed) return { error: "API key cannot be empty" };

  // Provider-specific format validation before making a network call
  const formatError = validateKeyFormat(provider, trimmed);
  if (formatError) return { error: formatError };

  let credential: ReturnType<typeof buildCredentialForStorage>;
  try {
    credential = buildCredentialForStorage(provider, trimmed);
  } catch {
    return { error: "Invalid local LLM connector." };
  }

  const model = requestedModel?.trim() || defaultModelForProvider(provider);
  const validation = await pingProviderKey({
    provider,
    apiKey: credential.storedCredential,
    model,
  });

  if (!validation.isValid) {
    return { error: validation.error ?? "API key validation failed." };
  }

  return {
    validatedAt: new Date().toISOString(),
    modelUsed: model,
  };
}

type UpsertApiKeyOptions = {
  defaultModel?: string | null;
  enabled?: boolean;
  validateBeforeSave?: boolean;
};

export async function upsertApiKey(
  provider: ApiKeyProvider,
  rawKey: string,
  options?: UpsertApiKeyOptions
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  if (!PROVIDERS.includes(provider)) return { error: "Invalid provider" };

  const trimmed = rawKey.trim();
  if (!trimmed) return { error: "API key cannot be empty" };
  if (trimmed.length < 8) return { error: "API key is too short" };

  // Provider-specific format validation
  const formatError = validateKeyFormat(provider, trimmed);
  if (formatError) return { error: formatError };
  let credential: ReturnType<typeof buildCredentialForStorage>;
  try {
    credential = buildCredentialForStorage(provider, trimmed);
  } catch {
    return { error: "Invalid local LLM connector." };
  }

  const defaultModel =
    options?.defaultModel?.trim() || defaultModelForProvider(provider);
  if (options?.validateBeforeSave) {
    const validation = await pingProviderKey({
      provider,
      apiKey: credential.storedCredential,
      model: defaultModel,
    });
    if (!validation.isValid) {
      return { error: validation.error ?? "API key validation failed." };
    }
  }

  const encryptedKey = UserApiKeyModel.encryptApiKey(
    credential.storedCredential
  );
  const keyHint = credential.keyHint;
  const now = new Date();

  await db.userApiKey.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: {
      userId: session.user.id,
      provider,
      encryptedKey,
      keyHint,
      defaultModel,
      enabled: options?.enabled ?? true,
      lastValidatedAt: options?.validateBeforeSave ? now : null,
      validationError: null,
    },
    update: {
      encryptedKey,
      keyHint,
      defaultModel,
      enabled: options?.enabled ?? true,
      lastValidatedAt: options?.validateBeforeSave ? now : undefined,
      validationError: null,
    },
  });

  revalidatePath("/settings/api-keys");
  revalidatePath("/project");
  return {};
}

export async function deleteApiKey(
  provider: ApiKeyProvider
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  if (!PROVIDERS.includes(provider)) return { error: "Invalid provider" };

  await db.userApiKey.deleteMany({
    where: { userId: session.user.id, provider },
  });

  revalidatePath("/settings/api-keys");
  return {};
}

export async function updateApiKeySettings(
  provider: ApiKeyProvider,
  input: { defaultModel?: string | null; enabled?: boolean }
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!PROVIDERS.includes(provider)) return { error: "Invalid provider" };

  const updateData: {
    defaultModel?: string | null;
    enabled?: boolean;
  } = {};

  if (typeof input.defaultModel !== "undefined") {
    updateData.defaultModel =
      input.defaultModel?.trim() || defaultModelForProvider(provider);
  }
  if (typeof input.enabled === "boolean") {
    updateData.enabled = input.enabled;
  }

  await db.userApiKey.updateMany({
    where: { userId: session.user.id, provider },
    data: updateData,
  });

  revalidatePath("/settings/api-keys");
  revalidatePath("/project");
  return {};
}

/** Retrieve the decrypted API key for internal server-side AI calls. */
export async function getDecryptedApiKey(
  provider: ApiKeyProvider
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const record = await UserApiKeyModel.findForUser({
    userId: session.user.id,
    provider,
  });

  if (!record) return null;
  return UserApiKeyModel.decryptApiKey(record.encryptedKey);
}

export async function getDecryptedApiKeyByIdForUser(input: {
  userId: string;
  userApiKeyId: string;
}): Promise<{ provider: ApiKeyProvider; apiKey: string } | null> {
  const record = await UserApiKeyModel.findByIdForUser(input);
  if (!record) {
    return null;
  }

  return {
    provider: record.provider,
    apiKey: UserApiKeyModel.decryptApiKey(record.encryptedKey),
  };
}
