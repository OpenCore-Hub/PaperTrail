/**
 * Plan-gating helpers.
 *
 * Keeps feature entitlement checks centralized so the rest of the app can ask
 * `isFeatureAllowed(plan)` without hard-coding plan names in route handlers.
 */

export function isDataroomIntelligenceAllowed(plan: string): boolean {
  return plan !== "free";
}
