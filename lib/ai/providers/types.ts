export interface AiMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface CompletionOptions {
  messages: AiMessageInput[];
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  content: string;
  usage: TokenUsage;
}

export interface EmbedOptions {
  text: string;
}

export interface IAiProvider {
  id: string;
  complete(options: CompletionOptions): Promise<CompletionResult>;
  embed(options: EmbedOptions): Promise<number[]>;
}
