import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/settings/ApiKeyCard", () => ({
  ApiKeyCard: ({ initial }: { initial: { provider: string } }) => (
    <div data-testid={`api-key-card-${initial.provider}`}>
      {initial.provider}
    </div>
  ),
}));

const { ApiKeySection } = await import("@/components/settings/ApiKeySection");

describe("ApiKeySection", () => {
  const labels = {
    providers: {
      OPENAI: { name: "OpenAI", description: "OpenAI", placeholder: "sk-..." },
      ANTHROPIC: { name: "Anthropic", description: "Anthropic", placeholder: "sk-ant-..." },
      GOOGLE: { name: "Google", description: "Google", placeholder: "AIzaSy..." },
      LOCAL: { name: "Local LLM", description: "Local", placeholder: "http://localhost:11434/v1" },
    },
    connectedStatus: "Connected",
    notConfiguredStatus: "Not configured",
    updateCredentialTitle: "Update connector",
    revokeCredentialTitle: "Remove connector",
    cancelTitle: "Cancel",
    pasteNewCredentialPlaceholder: "Paste new key",
    localEndpointLabel: "Endpoint URL",
    localEndpointPlaceholder: "http://localhost:11434/v1",
    localApiKeyLabel: "API key",
    localApiKeyPlaceholder: "Optional bearer token",
    localApiKeyHint: "Use an endpoint reachable from the app server.",
    localEndpointInvalid: "Enter a valid HTTP(S) endpoint URL.",
    defaultModelLabel: "Default model",
    enabledLabel: "Connector enabled for diligence jobs",
    saveSettingsCta: "Save connector settings",
    saveCta: "Save",
    savingCta: "Saving...",
    updateCta: "Update",
    testConnectionCta: "Test connection",
    testingConnectionCta: "Testing...",
  } as const;

  const mockStatuses = [
    {
      id: "key-1",
      provider: "OPENAI" as const,
      isSet: true,
      hint: "abcd",
      connectorUrl: null,
      defaultModel: "gpt-4o-mini",
      enabled: true,
      lastValidatedAt: "2024-06-01T00:00:00Z",
    },
    {
      id: null,
      provider: "ANTHROPIC" as const,
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: "claude-3-5-sonnet-latest",
      enabled: false,
      lastValidatedAt: null,
    },
    {
      id: null,
      provider: "GOOGLE" as const,
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: "gemini-2.5-flash",
      enabled: false,
      lastValidatedAt: null,
    },
    {
      id: null,
      provider: "LOCAL" as const,
      isSet: false,
      hint: null,
      connectorUrl: null,
      defaultModel: "llama3.1",
      enabled: false,
      lastValidatedAt: null,
    },
  ];

  it("renders an ApiKeyCard for each provider", () => {
    render(<ApiKeySection initial={mockStatuses} labels={labels} />);

    expect(screen.getByTestId("api-key-card-OPENAI")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-card-ANTHROPIC")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-card-GOOGLE")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-card-LOCAL")).toBeInTheDocument();
  });

  it("renders the correct number of cards", () => {
    render(<ApiKeySection initial={mockStatuses} labels={labels} />);

    const cards = screen.getAllByTestId(/^api-key-card-/);
    expect(cards).toHaveLength(4);
  });

  it("renders with empty initial array", () => {
    render(<ApiKeySection initial={[]} labels={labels} />);

    const cards = screen.queryAllByTestId(/^api-key-card-/);
    expect(cards).toHaveLength(0);
  });
});
