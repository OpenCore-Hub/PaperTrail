import { test, expect } from "@playwright/test";

test("health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body).toHaveProperty("status");
  expect(body).toHaveProperty("checks");
  expect(body.checks).toHaveProperty("database");
});
