import { test, expect } from "@playwright/test";
import { seedConstants } from "./fixtures/seed";

test("signs in with seeded credentials and lands on dashboard", async ({
  page,
}) => {
  await page.goto("/auth/signin");

  await page.fill('input[id="email"]', seedConstants.adminEmail);
  await page.fill('input[id="password"]', seedConstants.adminPassword);

  const submitPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/callback/credentials") &&
      resp.status() === 302,
  );

  await page.click('button[type="submit"]');
  await submitPromise;

  await page.waitForURL("/dashboard");
  await expect(page.locator("text=Documents")).toBeVisible();
});
