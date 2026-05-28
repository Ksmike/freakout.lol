import { describe, it, expect, vi } from "vitest";
import { ApiKeyProvider } from "@/lib/generated/prisma/client";

vi.mock("@/lib/generated/prisma/client", () => ({
  ApiKeyProvider: {
    OPENAI: "OPENAI",
    ANTHROPIC: "ANTHROPIC",
    GOOGLE: "GOOGLE",
    LOCAL: "LOCAL",
  },
}));

const mockChatOpenAI = vi.fn();
const mockChatAnthropic = vi.fn();
const mockChatGoogleGenerativeAI = vi.fn();

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: mockChatOpenAI,
}));

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: mockChatAnthropic,
}));

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: mockChatGoogleGenerativeAI,
}));

const { ModelProviderRegistry } = await import("@/lib/diligence/model-provider");

describe("ModelProviderRegistry", () => {
  it("creates a registry with all providers", () => {
    const registry = new ModelProviderRegistry();
    expect(registry.getProvider(ApiKeyProvider.OPENAI)).toBeDefined();
    expect(registry.getProvider(ApiKeyProvider.ANTHROPIC)).toBeDefined();
    expect(registry.getProvider(ApiKeyProvider.GOOGLE)).toBeDefined();
    expect(registry.getProvider(ApiKeyProvider.LOCAL)).toBeDefined();
  });

  it("throws for unsupported provider", () => {
    const registry = new ModelProviderRegistry();
    expect(() => registry.getProvider("UNKNOWN" as ApiKeyProvider)).toThrow(
      "Unsupported provider: UNKNOWN"
    );
  });

  describe("OpenAI provider", () => {
    it("creates a ChatOpenAI model with correct config", () => {
      const registry = new ModelProviderRegistry();
      const provider = registry.getProvider(ApiKeyProvider.OPENAI);

      provider.createChatModel({
        provider: ApiKeyProvider.OPENAI,
        model: "gpt-4o",
        apiKey: "sk-test",
        temperature: 0.5,
        maxRetries: 3,
      });

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test",
        model: "gpt-4o",
        temperature: 0.5,
        maxRetries: 3,
      });
    });

    it("uses default temperature 0 and maxRetries 2", () => {
      const registry = new ModelProviderRegistry();
      const provider = registry.getProvider(ApiKeyProvider.OPENAI);

      provider.createChatModel({
        provider: ApiKeyProvider.OPENAI,
        model: "gpt-4o",
        apiKey: "sk-test",
      });

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test",
        model: "gpt-4o",
        temperature: 0,
        maxRetries: 2,
      });
    });
  });

  describe("Anthropic provider", () => {
    it("creates a ChatAnthropic model with correct config", () => {
      const registry = new ModelProviderRegistry();
      const provider = registry.getProvider(ApiKeyProvider.ANTHROPIC);

      provider.createChatModel({
        provider: ApiKeyProvider.ANTHROPIC,
        model: "claude-3-5-sonnet",
        apiKey: "sk-ant-test",
        temperature: 0.2,
        maxRetries: 1,
      });

      expect(mockChatAnthropic).toHaveBeenCalledWith({
        apiKey: "sk-ant-test",
        model: "claude-3-5-sonnet",
        temperature: 0.2,
        maxRetries: 1,
      });
    });
  });

  describe("Google provider", () => {
    it("creates a ChatGoogleGenerativeAI model with correct config", () => {
      const registry = new ModelProviderRegistry();
      const provider = registry.getProvider(ApiKeyProvider.GOOGLE);

      provider.createChatModel({
        provider: ApiKeyProvider.GOOGLE,
        model: "gemini-2.5-flash",
        apiKey: "AIzaSy-test",
      });

      expect(mockChatGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: "AIzaSy-test",
        model: "gemini-2.5-flash",
        temperature: 0,
        maxRetries: 2,
      });
    });
  });

  describe("Local LLM provider", () => {
    it("creates a ChatOpenAI model with a local base URL", () => {
      const registry = new ModelProviderRegistry();
      const provider = registry.getProvider(ApiKeyProvider.LOCAL);

      provider.createChatModel({
        provider: ApiKeyProvider.LOCAL,
        model: "llama3.1",
        apiKey: JSON.stringify({
          baseUrl: "http://localhost:11434/v1",
          apiKey: null,
        }),
      });

      expect(mockChatOpenAI).toHaveBeenCalledWith({
        apiKey: "local-llm",
        model: "llama3.1",
        temperature: 0,
        maxRetries: 2,
        useResponsesApi: false,
        configuration: {
          baseURL: "http://localhost:11434/v1",
        },
      });
    });
  });
});
