import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/generated/prisma/client", () => ({
  ApiKeyProvider: {
    OPENAI: "OPENAI",
    ANTHROPIC: "ANTHROPIC",
    GOOGLE: "GOOGLE",
    LOCAL: "LOCAL",
  },
}));

const { ModelRouter, defaultModelForProvider } = await import(
  "@/lib/diligence/model-router"
);

describe("ModelRouter", () => {
  const router = new ModelRouter();

  describe("route", () => {
    it("selects the first enabled key when no provider is specified", () => {
      const result = router.route({
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: "gpt-4o", enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: null, enabled: true },
        ],
      });

      expect(result.userApiKeyId).toBe("key-1");
      expect(result.selectedProvider).toBe("OPENAI");
      expect(result.selectedModel).toBe("gpt-4o");
      expect(result.fallbackProviders).toEqual(["ANTHROPIC"]);
    });

    it("selects the requested provider when specified", () => {
      const result = router.route({
        selectedProvider: "ANTHROPIC",
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: "gpt-4o", enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: "claude-3", enabled: true },
        ],
      });

      expect(result.userApiKeyId).toBe("key-2");
      expect(result.selectedProvider).toBe("ANTHROPIC");
      expect(result.selectedModel).toBe("claude-3");
      expect(result.fallbackProviders).toEqual(["OPENAI"]);
    });

    it("uses selectedModel when provided", () => {
      const result = router.route({
        selectedProvider: "OPENAI",
        selectedModel: "gpt-4-turbo",
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: "gpt-4o", enabled: true },
        ],
      });

      expect(result.selectedModel).toBe("gpt-4-turbo");
    });

    it("falls back to provider default model when key has no defaultModel", () => {
      const result = router.route({
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: null, enabled: true },
        ],
      });

      expect(result.selectedModel).toBe("gpt-4o-mini");
    });

    it("throws when no enabled keys are available", () => {
      expect(() =>
        router.route({
          keys: [
            { id: "key-1", provider: "OPENAI", defaultModel: null, enabled: false },
          ],
        })
      ).toThrow("No enabled provider keys are configured.");
    });

    it("throws when all keys are disabled", () => {
      expect(() =>
        router.route({
          keys: [],
        })
      ).toThrow("No enabled provider keys are configured.");
    });

    it("deduplicates fallback providers", () => {
      const result = router.route({
        selectedProvider: "OPENAI",
        fallbackProviders: ["ANTHROPIC", "ANTHROPIC", "GOOGLE"],
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: null, enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: null, enabled: true },
          { id: "key-3", provider: "GOOGLE", defaultModel: null, enabled: true },
        ],
      });

      expect(result.fallbackProviders).toEqual(["ANTHROPIC", "GOOGLE"]);
    });

    it("excludes selected provider from fallbacks", () => {
      const result = router.route({
        selectedProvider: "OPENAI",
        fallbackProviders: ["OPENAI", "ANTHROPIC"],
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: null, enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: null, enabled: true },
        ],
      });

      expect(result.fallbackProviders).toEqual(["ANTHROPIC"]);
    });

    it("only includes fallback providers that have enabled keys", () => {
      const result = router.route({
        selectedProvider: "OPENAI",
        fallbackProviders: ["ANTHROPIC", "GOOGLE"],
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: null, enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: null, enabled: true },
          // GOOGLE key is disabled, so not in enabled list
        ],
      });

      expect(result.fallbackProviders).toEqual(["ANTHROPIC"]);
    });

    it("falls back to first enabled key when requested provider is not available", () => {
      const result = router.route({
        selectedProvider: "GOOGLE",
        keys: [
          { id: "key-1", provider: "OPENAI", defaultModel: "gpt-4o", enabled: true },
          { id: "key-2", provider: "ANTHROPIC", defaultModel: null, enabled: true },
        ],
      });

      expect(result.userApiKeyId).toBe("key-1");
      expect(result.selectedProvider).toBe("OPENAI");
    });
  });
});

describe("defaultModelForProvider", () => {
  it("returns gpt-4o-mini for OPENAI", () => {
    expect(defaultModelForProvider("OPENAI")).toBe("gpt-4o-mini");
  });

  it("returns claude-3-5-sonnet-latest for ANTHROPIC", () => {
    expect(defaultModelForProvider("ANTHROPIC")).toBe("claude-3-5-sonnet-latest");
  });

  it("returns gemini-2.5-flash for GOOGLE", () => {
    expect(defaultModelForProvider("GOOGLE")).toBe("gemini-2.5-flash");
  });

  it("returns llama3.1 for LOCAL", () => {
    expect(defaultModelForProvider("LOCAL")).toBe("llama3.1");
  });
});
