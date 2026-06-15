/**
 * Workspace role definitions.
 *
 * These string values are kept in sync with the Prisma `UserRole` enum in
 * `prisma/schema.prisma`. Changing one requires changing the other.
 */
export const UserRole = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Roles that can mutate documents and share links.
 */
export function canManageDocuments(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.EDITOR;
}

/**
 * Roles that can access workspace administration (members, invites, custom
 * domain).
 */
export function canManageWorkspace(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Roles that can mutate dataroom structure (create, update, mount documents,
 * manage folders).
 */
export function canManageDataroom(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.EDITOR;
}
