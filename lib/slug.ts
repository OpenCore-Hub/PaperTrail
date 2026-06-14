import { customAlphabet } from "nanoid";

export function generateWorkspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

export function generateShareSlug(): string {
  // URL-safe base64url alphabet, 12 chars ~= 72 bits of entropy
  return customAlphabet(
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
    12,
  )();
}
