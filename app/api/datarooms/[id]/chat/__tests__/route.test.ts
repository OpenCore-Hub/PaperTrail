import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const {
  getServerSessionMock,
  checkAiQueryAllowedMock,
  askDataroomQuestionMock,
  dataroomFindFirstMock,
  workspaceFindUniqueMock,
  viewerGrantFindUniqueMock,
  aiConversationFindFirstMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  checkAiQueryAllowedMock: vi.fn(),
  askDataroomQuestionMock: vi.fn(),
  dataroomFindFirstMock: vi.fn(),
  workspaceFindUniqueMock: vi.fn(),
  viewerGrantFindUniqueMock: vi.fn(),
  aiConversationFindFirstMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataroom: { findFirst: dataroomFindFirstMock },
    workspace: { findUnique: workspaceFindUniqueMock },
    viewerGrant: { findUnique: viewerGrantFindUniqueMock },
    aiConversation: { findFirst: aiConversationFindFirstMock },
  },
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkAiQueryAllowed: checkAiQueryAllowedMock,
}));

vi.mock("@/lib/ai/dataroom-chat", () => ({
  askDataroomQuestion: askDataroomQuestionMock,
}));

function mockSession(role: "ADMIN" | "EDITOR" | "VIEWER" = "ADMIN") {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role },
  });
}

function makeGetRequest(
  dataroomId = "dr-1",
  conversationId?: string,
  viewerToken?: string,
): NextRequest {
  let url = `http://localhost:3000/api/datarooms/${dataroomId}/chat`;
  if (conversationId) {
    url += `?conversationId=${conversationId}`;
  }
  const headers = new Headers();
  if (viewerToken) headers.set("X-Viewer-Token", viewerToken);
  return new NextRequest(url, { headers });
}

function makePostRequest(
  body: unknown,
  dataroomId = "dr-1",
  viewerToken?: string,
): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (viewerToken) headers.set("X-Viewer-Token", viewerToken);
  return new NextRequest(
    `http://localhost:3000/api/datarooms/${dataroomId}/chat`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  checkAiQueryAllowedMock.mockResolvedValue(true);
});

describe("GET /api/datarooms/[id]/chat", () => {
  it("rejects unauthenticated requests", async () => {
    getServerSessionMock.mockResolvedValue(null);
    viewerGrantFindUniqueMock.mockResolvedValue(null);

    const res = await GET(makeGetRequest(), { params: { id: "dr-1" } });
    expect(res.status).toBe(401);
  });

  it("returns messages for a workspace session", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    aiConversationFindFirstMock.mockResolvedValue({
      id: "conv-1",
      title: "Question",
      messages: [
        {
          id: "msg-1",
          role: "USER",
          content: "What is this?",
          citations: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "msg-2",
          role: "ASSISTANT",
          content: "A dataroom.",
          citations: [{ pageNumber: 1, chunkId: "chunk-1", excerpt: "Excerpt" }],
          createdAt: "2024-01-01T00:00:01.000Z",
        },
      ],
    });

    const res = await GET(makeGetRequest("dr-1", "conv-1"), {
      params: { id: "dr-1" },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.messages).toHaveLength(2);
    expect(json.conversationId).toBe("conv-1");
  });

  it("returns 404 when conversation does not belong to dataroom", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    aiConversationFindFirstMock.mockResolvedValue(null);

    const res = await GET(makeGetRequest("dr-1", "conv-missing"), {
      params: { id: "dr-1" },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/datarooms/[id]/chat", () => {
  it("rejects unauthenticated requests", async () => {
    getServerSessionMock.mockResolvedValue(null);
    viewerGrantFindUniqueMock.mockResolvedValue(null);

    const res = await POST(
      makePostRequest({ question: "Hello" }),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mockSession();

    const res = await POST(
      makePostRequest({ question: "" }),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 on free plan", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    workspaceFindUniqueMock.mockResolvedValue({ plan: "free" });

    const res = await POST(
      makePostRequest({ question: "Hello" }),
      { params: { id: "dr-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe(
      "Dataroom intelligence is not available on the free plan",
    );
  });

  it("returns 429 when workspace AI rate limit exceeded", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    workspaceFindUniqueMock.mockResolvedValue({ plan: "pro" });
    checkAiQueryAllowedMock.mockResolvedValue(false);

    const res = await POST(
      makePostRequest({ question: "Hello" }),
      { params: { id: "dr-1" } },
    );
    expect(res.status).toBe(429);
  });

  it("returns 503 when dataroom has no AI-ready documents", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    workspaceFindUniqueMock.mockResolvedValue({ plan: "pro" });
    askDataroomQuestionMock.mockRejectedValue(
      new Error("Dataroom dr-1 has no AI-ready documents."),
    );

    const res = await POST(
      makePostRequest({ question: "Hello" }),
      { params: { id: "dr-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toContain("not yet indexed");
  });

  it("accepts viewer grant tokens and returns AI result", async () => {
    getServerSessionMock.mockResolvedValue(null);
    viewerGrantFindUniqueMock.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date(Date.now() + 60_000),
      link: {
        dataroom: { id: "dr-1", workspaceId: "ws-1" },
      },
    });
    workspaceFindUniqueMock.mockResolvedValue({ plan: "pro" });
    askDataroomQuestionMock.mockResolvedValue({
      answer: "It covers goals.",
      citations: [
        {
          pageNumber: 1,
          chunkId: "chunk-1",
          excerpt: "Goals",
          documentId: "doc-1",
          documentName: "A.pdf",
        },
      ],
      conversationId: "conv-1",
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    const res = await POST(
      makePostRequest({ question: "What?" }, "dr-1", "viewer-token-123"),
      { params: { id: "dr-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.answer).toBe("It covers goals.");
    expect(json.citations).toHaveLength(1);
    expect(json.conversationId).toBe("conv-1");
    expect(askDataroomQuestionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dataroomId: "dr-1",
        workspaceId: "ws-1",
        question: "What?",
      }),
    );
  });

  it("returns AI result for a workspace session", async () => {
    mockSession();
    dataroomFindFirstMock.mockResolvedValue({ id: "dr-1", workspaceId: "ws-1" });
    workspaceFindUniqueMock.mockResolvedValue({ plan: "pro" });
    askDataroomQuestionMock.mockResolvedValue({
      answer: "Answer.",
      citations: [],
      conversationId: "conv-2",
      usage: { promptTokens: 5, completionTokens: 2 },
    });

    const res = await POST(
      makePostRequest({ question: "Hello" }),
      { params: { id: "dr-1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.answer).toBe("Answer.");
    expect(json.conversationId).toBe("conv-2");
  });
});
