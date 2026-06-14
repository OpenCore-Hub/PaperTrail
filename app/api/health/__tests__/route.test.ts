import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { queryRawMock, listFilesMock, MockUTApi } = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const listFiles = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockUTApi(this: any) {
    this.listFiles = listFiles;
  }
  return { queryRawMock: queryRaw, listFilesMock: listFiles, MockUTApi };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

vi.mock("uploadthing/server", () => ({
  UTApi: MockUTApi,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when all checks pass", async () => {
    queryRawMock.mockResolvedValue([{ 1: 1 }]);
    listFilesMock.mockResolvedValue({ files: [] });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.checks.database.status).toBe("ok");
    expect(json.checks.storage.status).toBe("ok");
  });

  it("returns 503 when database is down", async () => {
    queryRawMock.mockRejectedValue(new Error("Connection refused"));
    listFilesMock.mockResolvedValue({ files: [] });

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.database.status).toBe("error");
  });

  it("returns 503 when storage is down", async () => {
    queryRawMock.mockResolvedValue([{ 1: 1 }]);
    listFilesMock.mockRejectedValue(new Error("UploadThing unreachable"));

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.storage.status).toBe("error");
  });
});
