import { test, expect } from "@playwright/test";
import { seedConstants } from "./fixtures/seed";

test("viewer role sees a read-only dashboard", async ({ page }) => {
  const viewerEmail = `e2e-viewer-${Date.now()}@example.com`;
  const viewerPassword = "viewer-password-123";

  // Sign in as admin.
  await page.goto("/auth/signin");
  await page.fill('input[id="email"]', seedConstants.adminEmail);
  await page.fill('input[id="password"]', seedConstants.adminPassword);

  const adminSubmitPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/callback/credentials") &&
      resp.status() === 200,
  );
  await page.click('button[type="submit"]');
  await adminSubmitPromise;
  await page.waitForURL("/dashboard");

  // Invite a viewer.
  await page.goto("/dashboard/settings/team");
  await expect(page.locator("text=Invite member")).toBeVisible();

  const invitePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/team/invite") && resp.status() === 201,
  );
  await page.fill('input[id="invite-email"]', viewerEmail);
  await page.click("#invite-role");
  await page.getByRole("option", { name: "Viewer" }).click();
  await page.click('button:has-text("Send invite")');
  const inviteResponse = await invitePromise;
  const inviteData = await inviteResponse.json();
  const inviteUrl: string = inviteData.invite.inviteUrl;
  expect(inviteData.invite.role).toBe("VIEWER");
  expect(inviteUrl).toContain("/auth/invite?token=");

  // Accept the invite as the viewer.
  await page.goto(inviteUrl);
  await expect(page.locator("text=Accept invite")).toBeVisible();
  await page.fill('input[id="name"]', "E2E Viewer");
  await page.fill('input[id="password"]', viewerPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL("/auth/signin");

  // Sign in as viewer.
  await page.fill('input[id="email"]', viewerEmail);
  await page.fill('input[id="password"]', viewerPassword);

  const viewerSubmitPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/callback/credentials") &&
      resp.status() === 200,
  );
  await page.click('button[type="submit"]');
  await viewerSubmitPromise;
  await page.waitForURL("/dashboard");

  // Read-only dashboard assertions.
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(
    page.getByText("View documents and share links in your workspace."),
  ).toBeVisible();
  await expect(page.getByTestId("upload-pdf-button")).not.toBeVisible();
  await expect(page.getByTestId("create-link-button")).not.toBeVisible();
  await expect(page.getByTestId("manage-links-button")).not.toBeVisible();
  await expect(page.getByTestId("delete-document-button")).not.toBeVisible();

  // Team settings and Analytics visibility.
  await expect(page.locator('a:has-text("Team")')).not.toBeVisible();
  await expect(page.locator('a:has-text("Analytics")')).toBeVisible();
});
