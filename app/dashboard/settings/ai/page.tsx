"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type AiMode = "CLOUD" | "BYOK" | "LOCAL";
type AiProvider = "openai" | "anthropic" | "ollama";

interface AiConfig {
  mode: AiMode;
  provider: AiProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
}

const DEFAULT_CONFIGS: Record<AiMode, Partial<AiConfig>> = {
  CLOUD: { provider: "openai", model: "gpt-4o-mini" },
  BYOK: { provider: "openai", model: "gpt-4o" },
  LOCAL: { provider: "ollama", model: "llama3.1" },
};

export default function AiSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AiConfig>({
    mode: "CLOUD",
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: null,
    baseUrl: null,
  });

  useEffect(() => {
    setLoading(true);
    fetch("/api/workspaces/ai-config")
      .then((res) => res.json())
      .then((data: AiConfig) => {
        setConfig(data);
      })
      .catch(() => toast.error("Failed to load AI settings"))
      .finally(() => setLoading(false));
  }, []);

  function handleModeChange(mode: AiMode) {
    setConfig((prev) => ({
      ...prev,
      mode,
      ...DEFAULT_CONFIGS[mode],
      apiKey: mode === "LOCAL" ? null : prev.apiKey,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/workspaces/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      toast.success("AI settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">AI Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Workspace AI Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mode">Mode</Label>
              <Select
                value={config.mode}
                onValueChange={(value) => handleModeChange(value as AiMode)}
              >
                <SelectTrigger id="mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOUD">
                    Cloud — managed by DocHub
                  </SelectItem>
                  <SelectItem value="BYOK">
                    BYOK — bring your own API key
                  </SelectItem>
                  <SelectItem value="LOCAL">
                    Local — self-hosted endpoint (Ollama)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={config.provider}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    provider: value as AiProvider,
                  }))
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={config.model}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder="e.g. gpt-4o-mini"
              />
            </div>

            {config.mode !== "LOCAL" && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  {config.mode === "BYOK" ? "API Key" : "API Key (optional)"}
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={config.apiKey ?? ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      apiKey: e.target.value || null,
                    }))
                  }
                  placeholder={
                    config.mode === "BYOK"
                      ? "sk-..."
                      : "Leave empty to use platform defaults"
                  }
                />
              </div>
            )}

            {config.mode !== "CLOUD" && (
              <div className="space-y-2">
                <Label htmlFor="baseUrl">
                  {config.mode === "LOCAL"
                    ? "Local Endpoint URL"
                    : "Custom Base URL (optional)"}
                </Label>
                <Input
                  id="baseUrl"
                  value={config.baseUrl ?? ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      baseUrl: e.target.value || null,
                    }))
                  }
                  placeholder={
                    config.mode === "LOCAL"
                      ? "http://localhost:11434/v1"
                      : "https://api.openai.com/v1"
                  }
                />
                {config.mode === "LOCAL" && (
                  <p className="text-sm text-muted-foreground">
                    Must expose OpenAI-compatible /v1/chat/completions and
                    /v1/embeddings endpoints.
                  </p>
                )}
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
