/**
 * Platform admin check.
 *
 * Returns true when the given systemRole is 'ADMIN'.
 * Pass session.user.systemRole directly — no DB query needed.
 */
export function isPlatformAdmin(systemRole: string | undefined | null): boolean {
  return systemRole === "ADMIN";
}
