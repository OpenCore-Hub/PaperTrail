import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const { getServerSessionMock, documentFindFirstMock, shareLinkFindManyMock } =
  vi.hoisted(() => ({
    getServerSessionMock: vi.fn(),
    documentFindFirstMock: vi.fn(),
    shareLinkFindManyMock: vi.fn(),
  }));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: documentFindFirstMock,
    },
    shareLink: {
      findMany: shareLinkFindManyMock,
    },
  },
}));

function makeRequest(id = "doc-1"): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/analytics/${id}/export`,
  ) as NextRequest;
}

function mockSession() {
  getServerSessionMock.mockResolvedValue({
    user: { id: "user-1", workspaceId: "ws-1", role: "ADMIN" },
  });
}

describe("GET /api/analytics/[documentId]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated users", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { documentId: "doc-1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when document is not in workspace", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { documentId: "doc-1" } });
    expect(res.status).toBe(404);
  });

  it("returns a CSV with session data", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      filename: "Q2 Deck.pdf",
    });
    shareLinkFindManyMock.mockResolvedValue([
      {
        slug: "abc123",
        sessions: [
          {
            id: "session-1",
            startedAt: new Date("2026-06-14T10:00:00Z"),
            durationSeconds: 45,
            viewerEmail: "viewer@example.com",
            fingerprint: "fp-1",
            pageViews: [
              { pageNumber: 1, durationSeconds: 20 },
              { pageNumber: 2, durationSeconds: 25 },
            ],
          },
        ],
      },
    ]);

    const res = await GET(makeRequest(), { params: { documentId: "doc-1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(
      "Q2_Deck_pdf_analytics.csv",
    );

    const body = await res.text();
    expect(body).toContain("Session ID");
    expect(body).toContain("session-1");
    expect(body).toContain("viewer@example.com");
    expect(body).toContain("abc123");
    expect(body).toContain("1; 2");
    expect(body).toContain("1:20; 2:25");
  });

  it("escapes commas and quotes in filenames", async () => {
    mockSession();
    documentFindFirstMock.mockResolvedValue({
      id: "doc-1",
      filename: 'Report, "Q2", Final.pdf',
    });
    shareLinkFindManyMock.mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: { documentId: "doc-1" } });
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("Report___Q2___Final_pdf_analytics.csv");
  });
});
