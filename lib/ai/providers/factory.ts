import type { AiProviderConfig, AiProviderMode } from "@prisma/client";
import { OpenAiProvider } from "./openai-provider";
import { AnthropicProvider } from "./anthropic-provider";
import { OllamaProvider } from "./ollama-provider";
import type { IAiProvider } from "./types";
import { decryptApiKey } from "../crypto";

export interface ResolvedAiConfig {
  mode: AiProviderMode;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export function resolveAiConfig(config: AiProviderConfig): ResolvedAiConfig {
  return {
    mode: config.mode,
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey ? decryptApiKey(config.apiKey) : undefined,
    baseUrl: config.baseUrl ?? undefined,
  };
}

export function createAiProvider(
  config: ResolvedAiConfig,
  defaults?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    embeddingModel?: string;
  },
): IAiProvider {
  switch (config.provider.toLowerCase()) {
    case "openai":
      return new OpenAiProvider({
        apiKey: config.apiKey ?? defaults?.openaiApiKey,
        baseUrl: config.baseUrl,
        completionModel: config.model,
        embeddingModel: defaults?.embeddingModel ?? "text-embedding-3-small",
      });

    case "anthropic":
      return new AnthropicProvider({
        apiKey: config.apiKey ?? defaults?.anthropicApiKey,
        baseUrl: config.baseUrl,
        completionModel: config.model,
        fallbackEmbedProvider: {
          provider: "openai",
          apiKey: defaults?.openaiApiKey,
          model: defaults?.embeddingModel ?? "text-embedding-3-small",
        },
      });

    case "ollama":
      return new OllamaProvider({
        baseUrl: config.baseUrl ?? "http://localhost:11434/v1",
        completionModel: config.model,
        embeddingModel:
          defaults?.embeddingModel ?? config.model ?? "nomic-embed-text",
      });

    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}
