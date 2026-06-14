import { test, expect } from "@playwright/test";
import { seedConstants, readSeedState } from "./fixtures/seed";

test("analytics dashboard reflects a new view session", async ({
  page,
  request,
}) => {
  const state = readSeedState();

  // Simulate a viewer opening the public link via the API so the test does
  // not depend on the PDF viewer rendering in the browser.
  const verifyRes = await request.post("/api/view/verify", {
    data: { linkId: state.openLinkId },
  });
  expect(verifyRes.ok()).toBeTruthy();
  const { token } = await verifyRes.json();

  const startRes = await request.post("/api/view", {
    data: {
      action: "start",
      linkId: state.openLinkId,
      viewerToken: token,
      fingerprint: "e2e-test-fingerprint",
    },
  });
  expect(startRes.ok()).toBeTruthy();

  // Log in as the workspace admin.
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

  // Open the analytics page for the seeded document.
  await page.goto(`/dashboard/analytics/${state.documentId}`);

  // Wait for the dashboard to load and assert the view was counted.
  await expect(page.getByTestId("stat-total-views")).toBeVisible();
  const totalViews = page
    .getByTestId("stat-total-views")
    .locator("div.text-3xl");
  await expect(totalViews).toHaveText(/^[1-9]\d*$/);

  const uniqueViewers = page
    .getByTestId("stat-unique-viewers")
    .locator("div.text-3xl");
  await expect(uniqueViewers).toHaveText(/^[1-9]\d*$/);
});
