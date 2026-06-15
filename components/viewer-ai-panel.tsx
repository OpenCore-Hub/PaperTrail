"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MessageSquare, Send, X, Bot, User, FileText } from "lucide-react";
import type { PdfViewerHandle } from "./pdf-viewer-content";

export interface Citation {
  pageNumber: number;
  chunkId: string;
  excerpt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface ViewerAiPanelProps {
  documentId: string;
  viewerToken?: string | null;
  pdfRef: React.RefObject<PdfViewerHandle>;
}

function storageKey(documentId: string) {
  return `dochub:ai-chat:${documentId}`;
}

export function ViewerAiPanel({
  documentId,
  viewerToken,
  pdfRef,
}: ViewerAiPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(documentId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { conversationId?: string };
        if (parsed.conversationId) {
          setConversationId(parsed.conversationId);
        }
      } catch {
        // ignore corrupt local storage
      }
    }
  }, [documentId]);

  useEffect(() => {
    if (!open || historyLoaded || !conversationId) return;

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (viewerToken) headers["X-Viewer-Token"] = viewerToken;

    fetch(
      `/api/documents/${encodeURIComponent(documentId)}/chat?conversationId=${encodeURIComponent(conversationId)}`,
      { headers },
    )
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Failed to load chat history");
        }
        return res.json() as Promise<{
          messages: Array<{
            id: string;
            role: "USER" | "ASSISTANT";
            content: string;
            citations?: Citation[];
          }>;
        }>;
      })
      .then((data) => {
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
            citations: m.citations,
          })),
        );
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load chat");
      })
      .finally(() => setHistoryLoaded(true));
  }, [open, documentId, viewerToken, conversationId, historyLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (viewerToken) headers["X-Viewer-Token"] = viewerToken;

    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            question,
            conversationId: conversationId ?? undefined,
          }),
        },
      );

      const data = (await res.json().catch(() => ({
        error: "Invalid response",
      }))) as {
        error?: string;
        answer?: string;
        citations?: Citation[];
        conversationId?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get AI answer");
      }

      const assistantMessage: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer ?? "",
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(
          storageKey(documentId),
          JSON.stringify({ conversationId: data.conversationId }),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
      // remove optimistic user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  }

  function jumpToCitation(pageNumber: number) {
    pdfRef.current?.scrollToPage(pageNumber);
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-full max-w-md flex-col shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Document AI Assistant</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(false)}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p>Ask a question about this document.</p>
              <p>Answers include page citations you can click to jump to.</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.citations.map((citation) => (
                      <Badge
                        key={citation.chunkId}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-accent"
                        onClick={() => jumpToCitation(citation.pageNumber)}
                        title={citation.excerpt}
                      >
                        p. {citation.pageNumber}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[80%] space-y-2 rounded-lg bg-muted px-3 py-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this document…"
            disabled={loading}
            maxLength={4000}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
