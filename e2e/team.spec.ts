import { test, expect } from "@playwright/test";
import { seedConstants } from "./fixtures/seed";

test("admin invites a new team member who accepts and signs in", async ({
  page,
}) => {
  const inviteeEmail = `e2e-invitee-${Date.now()}@example.com`;
  const inviteePassword = "invitee-password-123";

  // Log in as admin.
  await page.goto("/auth/signin");
  await page.fill('input[id="email"]', seedConstants.adminEmail);
  await page.fill('input[id="password"]', seedConstants.adminPassword);

  const submitPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/callback/credentials") &&
      resp.status() === 200,
  );
  await page.click('button[type="submit"]');
  await submitPromise;
  await page.waitForURL("/dashboard");

  // Go to team settings.
  await page.goto("/dashboard/settings/team");
  await expect(page.locator("text=Invite member")).toBeVisible();

  // Send invite and capture the invite URL from the API response.
  const invitePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/team/invite") && resp.status() === 201,
  );
  await page.fill('input[id="invite-email"]', inviteeEmail);
  await page.click('button:has-text("Send invite")');
  const inviteResponse = await invitePromise;
  const inviteData = await inviteResponse.json();
  const inviteUrl: string = inviteData.invite.inviteUrl;
  expect(inviteUrl).toContain("/auth/invite?token=");

  // Accept the invite.
  await page.goto(inviteUrl);
  await expect(page.locator("text=Accept invite")).toBeVisible();

  await page.fill('input[id="name"]', "E2E Invitee");
  await page.fill('input[id="password"]', inviteePassword);
  await page.click('button[type="submit"]');

  await page.waitForURL("/auth/signin");

  // Sign in as the new user.
  await page.fill('input[id="email"]', inviteeEmail);
  await page.fill('input[id="password"]', inviteePassword);

  const newUserSubmitPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/auth/callback/credentials") &&
      resp.status() === 200,
  );
  await page.click('button[type="submit"]');
  await newUserSubmitPromise;
  await page.waitForURL("/dashboard");

  await expect(page.locator("text=Documents")).toBeVisible();
});
