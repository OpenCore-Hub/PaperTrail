import { test, expect } from "@playwright/test";

test("health endpoint responds and database is healthy", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBeLessThan(600);

  const body = await response.json();
  expect(body).toHaveProperty("status");
  expect(body).toHaveProperty("checks");
  expect(body.checks).toHaveProperty("database");
  expect(body.checks.database.status).toBe("ok");
});
