import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDocumentAnalytics } from "@/lib/analytics";

const { mockDocumentFindFirst, mockShareLinkFindMany, mockPageViewGroupBy } =
  vi.hoisted(() => ({
    mockDocumentFindFirst: vi.fn(),
    mockShareLinkFindMany: vi.fn(),
    mockPageViewGroupBy: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: mockDocumentFindFirst },
    shareLink: { findMany: mockShareLinkFindMany },
    pageView: { groupBy: mockPageViewGroupBy },
  },
}));

describe("getDocumentAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates views, unique viewers, and page-level data", async () => {
    const now = new Date();
    const day = now.toISOString().split("T")[0];

    mockDocumentFindFirst.mockResolvedValue({
      id: "doc-1",
      filename: "test.pdf",
    });
    mockShareLinkFindMany.mockResolvedValue([
      {
        id: "link-1",
        sessions: [
          {
            id: "session-1",
            fingerprint: "fp-1",
            viewerEmail: "viewer@example.com",
            startedAt: now,
            durationSeconds: 10,
          },
          {
            id: "session-2",
            fingerprint: "fp-1",
            viewerEmail: null,
            startedAt: now,
            durationSeconds: 20,
          },
        ],
      },
    ]);
    mockPageViewGroupBy.mockResolvedValue([
      {
        pageNumber: 1,
        _count: { pageNumber: 2 },
        _sum: { durationSeconds: 30 },
      },
    ]);

    const result = await getDocumentAnalytics("doc-1", "ws-1");

    expect(result.document).toEqual({ id: "doc-1", filename: "test.pdf" });
    expect(result.summary).toEqual({
      totalViews: 2,
      uniqueViewers: 1,
      totalDuration: 30,
      avgDuration: 15,
    });
    expect(result.chartData).toEqual([{ date: day, views: 2 }]);
    expect(result.pageViewData).toEqual([
      { pageNumber: 1, views: 2, totalSeconds: 30 },
    ]);
    expect(result.recentSessions).toHaveLength(2);

    expect(mockDocumentFindFirst).toHaveBeenCalledWith({
      where: { id: "doc-1", workspaceId: "ws-1" },
      select: { id: true, filename: true },
    });
  });

  it("throws when the document does not exist in the workspace", async () => {
    mockDocumentFindFirst.mockResolvedValue(null);

    await expect(getDocumentAnalytics("doc-1", "ws-1")).rejects.toThrow(
      "Document not found",
    );
  });
});
