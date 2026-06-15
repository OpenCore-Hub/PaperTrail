import Anthropic from "@anthropic-ai/sdk";
import type {
  IAiProvider,
  CompletionOptions,
  CompletionResult,
  EmbedOptions,
} from "./types";

interface AnthropicProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  completionModel: string;
  fallbackEmbedProvider?: {
    provider: "openai";
    apiKey?: string;
    baseUrl?: string;
    model: string;
  };
}

export class AnthropicProvider implements IAiProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(private options: AnthropicProviderOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey ?? undefined,
      baseURL: options.baseUrl,
    });
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const systemMessage = options.messages.find((m) => m.role === "system");
    const conversationMessages = options.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: this.options.completionModel,
      system: systemMessage?.content,
      messages: conversationMessages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!content) {
      throw new Error("Anthropic returned empty completion");
    }

    return {
      content,
      usage: {
        promptTokens: response.usage?.input_tokens ?? 0,
        completionTokens: response.usage?.output_tokens ?? 0,
      },
    };
  }

  async embed(options: EmbedOptions): Promise<number[]> {
    const fallback = this.options.fallbackEmbedProvider;
    if (!fallback) {
      throw new Error(
        "Anthropic does not provide embeddings; configure a fallback embed provider",
      );
    }

    const { OpenAiProvider } = await import("./openai-provider");
    const embedProvider = new OpenAiProvider({
      apiKey: fallback.apiKey,
      baseUrl: fallback.baseUrl,
      completionModel: fallback.model,
      embeddingModel: fallback.model,
    });

    return embedProvider.embed(options);
  }
}
