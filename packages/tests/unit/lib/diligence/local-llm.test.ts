import { describe, expect, it } from "vitest";
import {
  getLocalLlmApiKey,
  normalizeLocalLlmBaseUrl,
  parseLocalLlmConnectorConfig,
  serializeLocalLlmConnectorConfig,
} from "@/lib/diligence/local-llm";

describe("local LLM connector helpers", () => {
  it("normalizes root endpoints to OpenAI-compatible /v1 base URLs", () => {
    expect(normalizeLocalLlmBaseUrl("http://localhost:11434")).toBe(
      "http://localhost:11434/v1"
    );
  });

  it("serializes and parses connector settings", () => {
    const serialized = serializeLocalLlmConnectorConfig({
      baseUrl: "http://localhost:11434",
      apiKey: " token ",
    });

    expect(parseLocalLlmConnectorConfig(serialized)).toEqual({
      baseUrl: "http://localhost:11434/v1",
      apiKey: "token",
    });
  });

  it("uses a placeholder key for unauthenticated local endpoints", () => {
    expect(
      getLocalLlmApiKey({
        baseUrl: "http://localhost:11434/v1",
        apiKey: null,
      })
    ).toBe("local-llm");
  });
});
