import { describe, it, expect } from "vitest";
import { isPlatformAdmin } from "@/lib/authz/platform-admin";

/**
 * Property 3: isPlatformAdmin is true if and only if systemRole is 'ADMIN'
 * Validates: Requirements 3.1, 3.2, 3.3
 */
describe("isPlatformAdmin", () => {
  it("returns true for 'ADMIN'", () => {
    expect(isPlatformAdmin("ADMIN")).toBe(true);
  });

  it("returns false for 'USER'", () => {
    expect(isPlatformAdmin("USER")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPlatformAdmin("")).toBe(false);
  });

  it("returns false for lowercase 'admin' (case-sensitive)", () => {
    expect(isPlatformAdmin("admin")).toBe(false);
  });

  it("returns false for 'SUPERADMIN'", () => {
    expect(isPlatformAdmin("SUPERADMIN")).toBe(false);
  });

  it("returns false for 'root'", () => {
    expect(isPlatformAdmin("root")).toBe(false);
  });

  // Property 3: parameterized test — for any non-ADMIN value, isPlatformAdmin returns false
  const NON_ADMIN_VALUES = [
    "USER",
    "",
    undefined,
    null,
    "admin",
    "SUPERADMIN",
    "root",
    "Admin",
    "ADMIN ",
    " ADMIN",
    "0",
    "true",
  ] as const;

  it.each(NON_ADMIN_VALUES)(
    "isPlatformAdmin(%s) is false for any non-ADMIN value",
    (value) => {
      expect(isPlatformAdmin(value as string)).toBe(false);
    }
  );
});
