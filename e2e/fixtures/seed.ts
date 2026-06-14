import fs from "fs";
import path from "path";

export const SEED_PATH = path.join(__dirname, "..", ".seed.json");

export const seedConstants = {
  workspaceName: "E2E Workspace",
  workspaceSlug: "e2e-workspace",
  adminEmail: "e2e-admin@example.com",
  adminPassword: "e2e-password-123",
  documentFilename: "sample.pdf",
  storageKey: "e2e-fake-storage-key",
  openSlug: "e2e-open-link",
  passwordSlug: "e2e-password-link",
  expiredSlug: "e2e-expired-link",
  passwordPlain: "secret",
};

export interface SeedState {
  workspaceId: string;
  userId: string;
  documentId: string;
  openLinkId: string;
  passwordLinkId: string;
  expiredLinkId: string;
}

export function writeSeedState(state: SeedState): void {
  fs.writeFileSync(SEED_PATH, JSON.stringify(state, null, 2));
}

export function readSeedState(): SeedState {
  return JSON.parse(fs.readFileSync(SEED_PATH, "utf-8")) as SeedState;
}
