import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ApiKeyProvider } from "@/lib/generated/prisma/client";
import {
  getLocalLlmApiKey,
  parseLocalLlmConnectorConfig,
} from "@/lib/diligence/local-llm";

export type UsageMetadata = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type ModelMessage = {
  content: unknown;
  usage_metadata?: UsageMetadata | null;
  response_metadata?: Record<string, unknown> | null;
};

export interface ChatModelLike {
  invoke(input: string): Promise<ModelMessage>;
}

export type ProviderModelConfig = {
  provider: ApiKeyProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxRetries?: number;
};

export interface ModelProvider {
  provider: ApiKeyProvider;
  createChatModel(config: ProviderModelConfig): ChatModelLike;
}

class OpenAiModelProvider implements ModelProvider {
  provider = ApiKeyProvider.OPENAI;

  createChatModel(config: ProviderModelConfig): ChatModelLike {
    return new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0,
      maxRetries: config.maxRetries ?? 2,
    }) as unknown as ChatModelLike;
  }
}

class AnthropicModelProvider implements ModelProvider {
  provider = ApiKeyProvider.ANTHROPIC;

  createChatModel(config: ProviderModelConfig): ChatModelLike {
    return new ChatAnthropic({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0,
      maxRetries: config.maxRetries ?? 2,
    }) as unknown as ChatModelLike;
  }
}

class GoogleModelProvider implements ModelProvider {
  provider = ApiKeyProvider.GOOGLE;

  createChatModel(config: ProviderModelConfig): ChatModelLike {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0,
      maxRetries: config.maxRetries ?? 2,
    }) as unknown as ChatModelLike;
  }
}

class LocalLlmModelProvider implements ModelProvider {
  provider = ApiKeyProvider.LOCAL;

  createChatModel(config: ProviderModelConfig): ChatModelLike {
    const connector = parseLocalLlmConnectorConfig(config.apiKey);
    if (!connector) {
      throw new Error("Local LLM connector is missing a valid base URL.");
    }

    return new ChatOpenAI({
      apiKey: getLocalLlmApiKey(connector),
      model: config.model,
      temperature: config.temperature ?? 0,
      maxRetries: config.maxRetries ?? 2,
      useResponsesApi: false,
      configuration: {
        baseURL: connector.baseUrl,
      },
    }) as unknown as ChatModelLike;
  }
}

export class ModelProviderRegistry {
  private readonly providers: Map<ApiKeyProvider, ModelProvider>;

  constructor() {
    const allProviders: ModelProvider[] = [
      new OpenAiModelProvider(),
      new AnthropicModelProvider(),
      new GoogleModelProvider(),
      new LocalLlmModelProvider(),
    ];
    this.providers = new Map(
      allProviders.map((provider) => [provider.provider, provider])
    );
  }

  getProvider(provider: ApiKeyProvider): ModelProvider {
    const resolved = this.providers.get(provider);
    if (!resolved) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return resolved;
  }
}
