import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockListForUser = vi.fn();
const mockDecryptApiKey = vi.fn();
vi.mock("@/lib/models/UserApiKeyModel", () => ({
  UserApiKeyModel: {
    listForUser: mockListForUser,
    findForUser: vi.fn(),
    findByIdForUser: vi.fn(),
    decryptApiKey: mockDecryptApiKey,
    encryptApiKey: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    userApiKey: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/generated/prisma/client", () => ({
  ApiKeyProvider: {
    OPENAI: "OPENAI",
    ANTHROPIC: "ANTHROPIC",
    GOOGLE: "GOOGLE",
    LOCAL: "LOCAL",
  },
}));

vi.mock("@/lib/diligence/model-provider", () => ({
  ModelProviderRegistry: class {},
}));

vi.mock("@/lib/diligence/model-router", () => ({
  MODEL_PROVIDER_ORDER: ["OPENAI", "ANTHROPIC", "GOOGLE", "LOCAL"],
  defaultModelForProvider: (provider: string) => {
    const defaults: Record<string, string> = {
      OPENAI: "gpt-4o-mini",
      ANTHROPIC: "claude-3-5-sonnet-latest",
      GOOGLE: "gemini-2.5-flash",
      LOCAL: "llama3.1",
    };
    return defaults[provider] ?? "unknown";
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { getApiKeyStatuses } = await import("@/lib/actions/apiKeys");

describe("getApiKeyStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default statuses when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getApiKeyStatuses();

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      id: null,
      provider: "OPENAI",
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: "gpt-4o-mini",
      enabled: false,
      lastValidatedAt: null,
    });
    expect(result[1].provider).toBe("ANTHROPIC");
    expect(result[2].provider).toBe("GOOGLE");
    expect(result[3].provider).toBe("LOCAL");
  });

  it("returns default statuses when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const result = await getApiKeyStatuses();

    expect(result).toHaveLength(4);
    result.forEach((status) => {
      expect(status.isSet).toBe(false);
      expect(status.enabled).toBe(false);
    });
  });

  it("returns statuses with user keys when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockListForUser.mockResolvedValue([
      {
        id: "key-1",
        provider: "OPENAI",
        encryptedKey: "encrypted-openai",
        keyHint: "abcd",
        defaultModel: "gpt-4o",
        enabled: true,
        lastValidatedAt: new Date("2024-06-01T00:00:00Z"),
      },
    ]);

    const result = await getApiKeyStatuses();

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      id: "key-1",
      provider: "OPENAI",
      isSet: true,
      hint: "abcd",
      connectorUrl: null,
      defaultModel: "gpt-4o",
      enabled: true,
      lastValidatedAt: "2024-06-01T00:00:00.000Z",
    });
    // Providers without keys
    expect(result[1]).toEqual({
      id: null,
      provider: "ANTHROPIC",
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: "claude-3-5-sonnet-latest",
      enabled: false,
      lastValidatedAt: null,
    });
  });

  it("uses defaultModelForProvider when key has no defaultModel", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockListForUser.mockResolvedValue([
      {
        id: "key-2",
        provider: "GOOGLE",
        encryptedKey: "encrypted-google",
        keyHint: "wxyz",
        defaultModel: null,
        enabled: true,
        lastValidatedAt: null,
      },
    ]);

    const result = await getApiKeyStatuses();

    const googleStatus = result.find((s) => s.provider === "GOOGLE");
    expect(googleStatus?.defaultModel).toBe("gemini-2.5-flash");
  });

  it("returns local LLM connector status with decrypted endpoint", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockListForUser.mockResolvedValue([
      {
        id: "key-local",
        provider: "LOCAL",
        encryptedKey: "encrypted-local",
        keyHint: "localhost:11434",
        defaultModel: "llama3.1",
        enabled: true,
        lastValidatedAt: null,
      },
    ]);
    mockDecryptApiKey.mockReturnValue(
      JSON.stringify({
        baseUrl: "http://localhost:11434/v1",
        apiKey: null,
      })
    );

    const result = await getApiKeyStatuses();

    const localStatus = result.find((s) => s.provider === "LOCAL");
    expect(localStatus).toEqual({
      id: "key-local",
      provider: "LOCAL",
      isSet: true,
      hint: "localhost:11434",
      connectorUrl: "http://localhost:11434/v1",
      defaultModel: "llama3.1",
      enabled: true,
      lastValidatedAt: null,
    });
  });
});
