import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockUpsertApiKey = vi.fn();
const mockDeleteApiKey = vi.fn();
const mockValidateApiKey = vi.fn();
const mockUpdateApiKeySettings = vi.fn();

vi.mock("@/lib/actions/apiKeys", () => ({
  upsertApiKey: (...args: unknown[]) => mockUpsertApiKey(...args),
  deleteApiKey: (...args: unknown[]) => mockDeleteApiKey(...args),
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  updateApiKeySettings: (...args: unknown[]) => mockUpdateApiKeySettings(...args),
}));

vi.mock("react-icons/si", () => ({
  SiOpenai: () => <span data-testid="icon-openai" />,
  SiAnthropic: () => <span data-testid="icon-anthropic" />,
  SiGoogle: () => <span data-testid="icon-google" />,
}));

vi.mock("react-icons/lu", () => ({
  LuServer: () => <span data-testid="icon-server" />,
}));

vi.mock("react-icons/fi", () => ({
  FiEdit2: () => <span data-testid="icon-edit" />,
  FiTrash2: () => <span data-testid="icon-trash" />,
  FiX: () => <span data-testid="icon-x" />,
  FiLoader: () => <span data-testid="icon-loader" />,
  FiAlertCircle: () => <span data-testid="icon-alert" />,
}));

const { ApiKeyCard } = await import("@/components/settings/ApiKeyCard");

describe("ApiKeyCard", () => {
  const mockOnUpdate = vi.fn();
  const labels = {
    providers: {
      OPENAI: {
        name: "OpenAI",
        description: "GPT-4o, o3, and reasoning models",
        placeholder: "sk-...",
      },
      ANTHROPIC: {
        name: "Anthropic",
        description: "Claude Sonnet, Opus, and Haiku",
        placeholder: "sk-ant-api03-...",
      },
      GOOGLE: {
        name: "Google AI",
        description: "Gemini 2.5 Pro and Flash",
        placeholder: "AIzaSy...",
      },
      LOCAL: {
        name: "Local LLM",
        description: "OpenAI-compatible local endpoint",
        placeholder: "http://localhost:11434/v1",
      },
    },
    connectedStatus: "Connected",
    notConfiguredStatus: "Not configured",
    updateCredentialTitle: "Update connector",
    revokeCredentialTitle: "Remove connector",
    cancelTitle: "Cancel",
    pasteNewCredentialPlaceholder: "Paste new key to update",
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

  const defaultInitial = {
    id: null,
    provider: "OPENAI" as const,
    isSet: false,
    hint: null,
    connectorUrl: null,
    defaultModel: "",
    enabled: false,
    lastValidatedAt: null,
  };

  const connectedInitial = {
    id: "key-1",
    provider: "OPENAI" as const,
    isSet: true,
    hint: "test",
    connectorUrl: null,
    defaultModel: "gpt-4o",
    enabled: true,
    lastValidatedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders provider name and description for unconfigured key", () => {
    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o, o3, and reasoning models")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("renders Connected badge when key is set", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows key hint when connected and idle", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("................test")).toBeInTheDocument();
  });

  it("shows input field when key is not set", () => {
    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByPlaceholderText("sk-...")).toBeInTheDocument();
  });

  it("shows Save button for new key", () => {
    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("shows edit and revoke buttons when connected", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByTitle("Update connector")).toBeInTheDocument();
    expect(screen.getByTitle("Remove connector")).toBeInTheDocument();
  });

  it("enters editing mode when edit button is clicked", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.click(screen.getByTitle("Update connector"));

    expect(screen.getByPlaceholderText("Paste new key to update")).toBeInTheDocument();
  });

  it("calls upsertApiKey on save", async () => {
    mockUpsertApiKey.mockResolvedValue({});

    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    const input = screen.getByPlaceholderText("sk-...");
    fireEvent.change(input, { target: { value: "sk-new-key-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpsertApiKey).toHaveBeenCalledWith("OPENAI", "sk-new-key-1234", {
        defaultModel: "",
        enabled: true,
      });
    });
  });

  it("shows error when upsertApiKey returns error", async () => {
    mockUpsertApiKey.mockResolvedValue({ error: "Invalid key format" });

    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    const input = screen.getByPlaceholderText("sk-...");
    fireEvent.change(input, { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid key format")).toBeInTheDocument();
    });
  });

  it("calls deleteApiKey on revoke", async () => {
    mockDeleteApiKey.mockResolvedValue({});

    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.click(screen.getByTitle("Remove connector"));

    await waitFor(() => {
      expect(mockDeleteApiKey).toHaveBeenCalledWith("OPENAI");
    });
  });

  it("calls validateApiKey on test key click", async () => {
    mockValidateApiKey.mockResolvedValue({ validatedAt: "2024-01-01" });

    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    const input = screen.getByPlaceholderText("sk-...");
    fireEvent.change(input, { target: { value: "sk-test-key" } });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(mockValidateApiKey).toHaveBeenCalledWith("OPENAI", "sk-test-key", "");
    });
  });

  it("shows validation error from test key", async () => {
    mockValidateApiKey.mockResolvedValue({ error: "Key is invalid" });

    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    const input = screen.getByPlaceholderText("sk-...");
    fireEvent.change(input, { target: { value: "sk-bad" } });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText("Key is invalid")).toBeInTheDocument();
    });
  });

  it("renders provider settings when connected and idle", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("Default model")).toBeInTheDocument();
    expect(screen.getByText("Connector enabled for diligence jobs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save connector settings/i })).toBeInTheDocument();
  });

  it("calls updateApiKeySettings on save settings", async () => {
    mockUpdateApiKeySettings.mockResolvedValue({});

    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save connector settings/i }));

    await waitFor(() => {
      expect(mockUpdateApiKeySettings).toHaveBeenCalledWith("OPENAI", {
        enabled: true,
        defaultModel: "gpt-4o",
      });
    });
  });

  it("cancels editing mode", () => {
    render(
      <ApiKeyCard
        initial={connectedInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.click(screen.getByTitle("Update connector"));
    expect(screen.getByPlaceholderText("Paste new key to update")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Cancel"));
    // Should go back to idle mode showing the hint
    expect(screen.getByText("................test")).toBeInTheDocument();
  });

  it("renders Anthropic provider correctly", () => {
    const anthropicInitial = {
      ...defaultInitial,
      provider: "ANTHROPIC" as const,
    };
    render(
      <ApiKeyCard
        initial={anthropicInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("Claude Sonnet, Opus, and Haiku")).toBeInTheDocument();
  });

  it("renders Google provider correctly", () => {
    const googleInitial = {
      ...defaultInitial,
      provider: "GOOGLE" as const,
    };
    render(
      <ApiKeyCard
        initial={googleInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText("Google AI")).toBeInTheDocument();
    expect(screen.getByText("Gemini 2.5 Pro and Flash")).toBeInTheDocument();
  });

  it("does not call save when input is empty", () => {
    render(
      <ApiKeyCard
        initial={defaultInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockUpsertApiKey).not.toHaveBeenCalled();
  });

  it("saves a local LLM connector with endpoint and optional token", async () => {
    mockUpsertApiKey.mockResolvedValue({});
    const localInitial = {
      ...defaultInitial,
      provider: "LOCAL" as const,
      defaultModel: "llama3.1",
    };

    render(
      <ApiKeyCard
        initial={localInitial}
        labels={labels}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "http://localhost:11434" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "local-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpsertApiKey).toHaveBeenCalledWith(
        "LOCAL",
        JSON.stringify({
          baseUrl: "http://localhost:11434/v1",
          apiKey: "local-token",
        }),
        {
          defaultModel: "llama3.1",
          enabled: true,
        }
      );
    });
  });
});
