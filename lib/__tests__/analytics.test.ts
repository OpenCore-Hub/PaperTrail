import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDocumentAnalytics } from "@/lib/analytics";

const { mockDocumentFindFirst, mockQueryRaw, mockViewSessionFindMany } =
  vi.hoisted(() => ({
    mockDocumentFindFirst: vi.fn(),
    mockQueryRaw: vi.fn(),
    mockViewSessionFindMany: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findFirst: mockDocumentFindFirst },
    $queryRaw: mockQueryRaw,
    viewSession: { findMany: mockViewSessionFindMany },
  },
}));

describe("getDocumentAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates views, unique viewers, and page-level data from the database", async () => {
    const now = new Date();
    const day = now.toISOString().split("T")[0];

    mockDocumentFindFirst.mockResolvedValue({
      id: "doc-1",
      filename: "test.pdf",
    });

    mockQueryRaw.mockImplementation((query: TemplateStringsArray) => {
      const sql = Array.isArray(query) ? query.join("?") : String(query);
      if (sql.includes("COUNT(DISTINCT")) {
        return [
          {
            totalViews: 2,
            uniqueViewers: 1,
            totalDuration: 30,
          },
        ];
      }
      if (sql.includes("DATE(vs.started_at)")) {
        return [{ date: day, views: 2 }];
      }
      if (sql.includes("pv.page_number")) {
        return [{ pageNumber: 1, views: 2, totalSeconds: 30 }];
      }
      return [];
    });

    mockViewSessionFindMany.mockResolvedValue([
      {
        id: "session-1",
        startedAt: now,
        durationSeconds: 10,
        viewerEmail: "viewer@example.com",
      },
      {
        id: "session-2",
        startedAt: now,
        durationSeconds: 20,
        viewerEmail: null,
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
    expect(mockViewSessionFindMany).toHaveBeenCalledWith({
      where: { link: { documentId: "doc-1" } },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        startedAt: true,
        durationSeconds: true,
        viewerEmail: true,
      },
    });
  });

  it("throws when the document does not exist in the workspace", async () => {
    mockDocumentFindFirst.mockResolvedValue(null);

    await expect(getDocumentAnalytics("doc-1", "ws-1")).rejects.toThrow(
      "Document not found",
    );
  });
});
