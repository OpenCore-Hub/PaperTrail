import OpenAI from "openai";
import type {
  IAiProvider,
  CompletionOptions,
  CompletionResult,
  EmbedOptions,
} from "./types";

interface OllamaProviderOptions {
  baseUrl: string;
  completionModel: string;
  embeddingModel: string;
}

export class OllamaProvider implements IAiProvider {
  readonly id = "ollama";
  private client: OpenAI;

  constructor(private options: OllamaProviderOptions) {
    this.client = new OpenAI({
      apiKey: "ollama",
      baseURL: options.baseUrl.replace(/\/$/, ""),
    });
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const response = await this.client.chat.completions.create({
      model: this.options.completionModel,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error("Ollama returned empty completion");
    }

    return {
      content: choice.message.content,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async embed(options: EmbedOptions): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.options.embeddingModel,
      input: options.text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("Ollama returned empty embedding");
    }

    return embedding;
  }
}
