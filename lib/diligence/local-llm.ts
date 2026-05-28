export type LocalLlmConnectorConfig = {
  baseUrl: string;
  apiKey: string | null;
};

export const LOCAL_LLM_PLACEHOLDER_API_KEY = "local-llm";

export function normalizeLocalLlmBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }

    url.hash = "";
    url.search = "";
    url.pathname =
      url.pathname === "" || url.pathname === "/"
        ? "/v1"
        : url.pathname.replace(/\/+$/, "");

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function serializeLocalLlmConnectorConfig(
  input: LocalLlmConnectorConfig
): string {
  const baseUrl = normalizeLocalLlmBaseUrl(input.baseUrl);
  if (!baseUrl) {
    throw new Error("Invalid local LLM base URL.");
  }

  return JSON.stringify({
    baseUrl,
    apiKey: input.apiKey?.trim() || null,
  });
}

export function parseLocalLlmConnectorConfig(
  value: string
): LocalLlmConnectorConfig | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      baseUrl?: unknown;
      baseURL?: unknown;
      apiKey?: unknown;
    };
    const baseUrlValue =
      typeof parsed.baseUrl === "string"
        ? parsed.baseUrl
        : typeof parsed.baseURL === "string"
          ? parsed.baseURL
          : "";
    const baseUrl = normalizeLocalLlmBaseUrl(baseUrlValue);
    if (!baseUrl) {
      return null;
    }

    return {
      baseUrl,
      apiKey: typeof parsed.apiKey === "string" && parsed.apiKey.trim()
        ? parsed.apiKey.trim()
        : null,
    };
  } catch {
    const baseUrl = normalizeLocalLlmBaseUrl(trimmed);
    return baseUrl ? { baseUrl, apiKey: null } : null;
  }
}

export function getLocalLlmApiKey(config: LocalLlmConnectorConfig): string {
  return config.apiKey?.trim() || LOCAL_LLM_PLACEHOLDER_API_KEY;
}

export function getLocalLlmConnectorHint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.host}${url.pathname === "/v1" ? "" : url.pathname}`;
  } catch {
    return baseUrl;
  }
}
