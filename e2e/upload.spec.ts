import { test, expect } from "@playwright/test";
import path from "path";
import { prisma } from "../lib/prisma";
import {
  readSeedState,
  appendUploadedStorageKey,
  seedConstants,
} from "./fixtures/seed";

const samplePdfPath = path.join(__dirname, "fixtures", "sample.pdf");

function hasUploadThingToken(): boolean {
  return Boolean(process.env.UPLOADTHING_TOKEN);
}

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
});

test("uploads a PDF and shows it in the document list", async ({ page }) => {
  test.skip(
    !hasUploadThingToken(),
    "UPLOADTHING_TOKEN is not configured; skipping real upload E2E.",
  );

  const state = readSeedState();

  await page.getByTestId("upload-pdf-button").click();
  await expect(page.locator("text=Upload a PDF")).toBeVisible();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator('input[type="file"]').click();
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles(samplePdfPath);

  // Wait for the upload to complete and the dialog to close.
  await expect(page.locator("text=Upload a PDF")).not.toBeVisible({
    timeout: 30_000,
  });

  // Verify the uploaded document card appears on the dashboard.
  await expect(
    page.locator(`text="${seedConstants.documentFilename}"`),
  ).toBeVisible({
    timeout: 5_000,
  });

  // Find the new document in the database and record its UploadThing key for
  // teardown cleanup.
  const uploadedDocument = await prisma.document.findFirst({
    where: {
      workspaceId: state.workspaceId,
      filename: seedConstants.documentFilename,
    },
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  expect(uploadedDocument).not.toBeNull();
  const storageKey = uploadedDocument?.versions[0]?.storageKey;
  if (storageKey) {
    appendUploadedStorageKey(storageKey);
  }
});
