import { test, expect } from "@playwright/test";
import { seedConstants } from "./fixtures/seed";

test("open link does not show access controls", async ({ page }) => {
  await page.goto(`/v/${seedConstants.openSlug}`);

  await expect(page.locator("text=Link expired")).not.toBeVisible();
  await expect(page.locator("text=Password protected")).not.toBeVisible();
});

test("password link grants access with the correct password", async ({
  page,
}) => {
  await page.goto(`/v/${seedConstants.passwordSlug}`);

  await expect(page.locator("text=Password protected")).toBeVisible();

  await page.fill('input[id="password"]', seedConstants.passwordPlain);

  const verifyPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/view/verify") && resp.status() === 200,
  );

  await page.click('button:has-text("View document")');
  await verifyPromise;

  await expect(page.locator("text=Access denied")).not.toBeVisible();
});

test("expired link shows expiration message", async ({ page }) => {
  await page.goto(`/v/${seedConstants.expiredSlug}`);
  await expect(page.locator("text=Link expired")).toBeVisible();
});
