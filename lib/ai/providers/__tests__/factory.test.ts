import { describe, it, expect, vi } from "vitest";
import { createAiProvider, resolveAiConfig } from "../factory";
import { OpenAiProvider } from "../openai-provider";
import { AnthropicProvider } from "../anthropic-provider";
import { OllamaProvider } from "../ollama-provider";
import { encryptApiKey } from "../../crypto";

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-ai-crypto-32bytes");

describe("createAiProvider", () => {
  it("creates an OpenAI provider", () => {
    const provider = createAiProvider({
      mode: "CLOUD",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
    });
    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it("creates an Anthropic provider", () => {
    const provider = createAiProvider({
      mode: "BYOK",
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("creates an Ollama provider", () => {
    const provider = createAiProvider({
      mode: "LOCAL",
      provider: "ollama",
      model: "llama3.1",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      createAiProvider({
        mode: "CLOUD",
        provider: "unknown",
        model: "x",
      }),
    ).toThrow("Unsupported AI provider");
  });
});

describe("resolveAiConfig", () => {
  it("decrypts the API key", () => {
    const key = "sk-secret";
    const config = {
      id: "cfg-1",
      workspaceId: "ws-1",
      mode: "BYOK" as const,
      provider: "openai",
      model: "gpt-4o",
      apiKey: encryptApiKey(key),
      baseUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resolved = resolveAiConfig(config);
    expect(resolved.apiKey).toBe(key);
  });
});
