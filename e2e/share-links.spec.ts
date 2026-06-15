import { test, expect } from "@playwright/test";
import { readSeedState, seedConstants } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
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
  // Wait for the dashboard client JS to hydrate and settle. Radix Dialog
  // triggers can appear enabled before their click handlers are attached in
  // dev mode, so wait for network idle as a proxy for hydration completion.
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator('[data-testid="create-link-button"]'),
  ).toBeEnabled();
  await expect(
    page.locator('[data-testid="manage-links-button"]'),
  ).toBeEnabled();
});

test("creates a new share link", async ({ page }) => {
  const state = readSeedState();
  const documentCard = page.locator(`[data-document-id="${state.documentId}"]`);
  await expect(documentCard).toBeVisible();

  const createButton = documentCard.getByTestId("create-link-button");
  await expect(createButton).toBeEnabled();
  await createButton.click();

  // Wait for the dialog to mount and become visible.
  const dialog = page.locator("role=dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("text=Create share link")).toBeVisible();

  // Enable viewer email capture and download.
  await page.locator('label:has-text("Require viewer email")').click();
  await page.locator('label:has-text("Allow download")').click();

  const createPromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/share") && resp.status() === 201,
  );

  await page.click('button[type="submit"]:has-text("Create link")');
  await createPromise;

  // The dialog switches to the success state with a copyable link.
  await expect(dialog.locator("text=Copy link")).toBeVisible({
    timeout: 5_000,
  });

  const linkText = await dialog.locator(".break-all").textContent();
  expect(linkText).toMatch(/\/v\/[A-Za-z0-9_-]+$/);

  // Close the dialog and verify the document card reflects the new link.
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(documentCard.locator("text=4 links")).toBeVisible();
});

test("edits an existing share link", async ({ page }) => {
  const state = readSeedState();
  const documentCard = page.locator(`[data-document-id="${state.documentId}"]`);
  await expect(documentCard).toBeVisible();

  // Step 1: Create a share link for the seeded document.
  const createButton = documentCard.getByTestId("create-link-button");
  await createButton.click();

  const createDialog = page.locator("role=dialog").filter({
    hasText: "Create share link",
  });
  await expect(createDialog).toBeVisible();

  const createPromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/share") && resp.status() === 201,
  );
  await createDialog.locator('button[type="submit"]').click();
  await createPromise;

  await page.keyboard.press("Escape");
  await expect(createDialog).not.toBeVisible();

  // Step 2: Open the manage links dialog and edit the newly created link.
  const manageButton = documentCard.getByTestId("manage-links-button");
  await expect(manageButton).toBeEnabled();
  await manageButton.click();

  const manageDialog = page.locator("role=dialog").filter({
    hasText: "Share links",
  });
  await expect(manageDialog).toBeVisible();

  const editButton = manageDialog.locator('button[title="Edit link"]').first();
  await editButton.click();

  const editDialog = page.locator("role=dialog").filter({
    hasText: "Edit share link",
  });
  await expect(editDialog).toBeVisible();

  await editDialog.locator('input[type="password"]').fill("new-password");

  const updatePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/share/") && resp.status() === 200,
  );
  await editDialog.locator('button[type="submit"]').click();
  await updatePromise;

  // The manage dialog list should now show the password as enabled on the
  // edited link (the most recently created link is listed first).
  await expect(manageDialog.locator("text=Enabled").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(editDialog).not.toBeVisible();
});
