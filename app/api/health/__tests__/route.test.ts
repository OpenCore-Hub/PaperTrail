import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("process", { ...process, env: { ...process.env } });
  });

  it("returns 200 when all checks pass", async () => {
    process.env.UPLOADTHING_TOKEN = "sk_live_xxx";
    queryRawMock.mockResolvedValue([{ 1: 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.checks.database.status).toBe("ok");
    expect(json.checks.storage.status).toBe("ok");
  });

  it("returns 503 when database is down", async () => {
    process.env.UPLOADTHING_TOKEN = "sk_live_xxx";
    queryRawMock.mockRejectedValue(new Error("Connection refused"));

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.database.status).toBe("error");
  });

  it("returns 503 when storage token is missing", async () => {
    delete process.env.UPLOADTHING_TOKEN;
    queryRawMock.mockResolvedValue([{ 1: 1 }]);

    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.storage.status).toBe("error");
    expect(json.checks.storage.detail).toContain("UPLOADTHING_TOKEN");
  });
});
