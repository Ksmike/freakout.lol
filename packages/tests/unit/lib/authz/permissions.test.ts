import { describe, expect, it } from "vitest";
import { FirmRole } from "@/lib/generated/prisma/client";
import {
  getFirmPermissions,
  hasFirmPermission,
} from "@/lib/authz/permissions";

describe("firm permissions", () => {
  it("allows owners to manage billing and projects", () => {
    expect(hasFirmPermission(FirmRole.OWNER, "billing.manage")).toBe(true);
    expect(hasFirmPermission(FirmRole.OWNER, "projects.create")).toBe(true);
  });

  it("does not allow analysts to manage members or billing", () => {
    expect(hasFirmPermission(FirmRole.ANALYST, "members.invite")).toBe(false);
    expect(hasFirmPermission(FirmRole.ANALYST, "billing.manage")).toBe(false);
    expect(hasFirmPermission(FirmRole.ANALYST, "workflow.run")).toBe(true);
  });

  it("returns the role permission list", () => {
    expect(getFirmPermissions(FirmRole.REVIEWER)).toEqual([
      "evidence.review",
      "outputs.approve",
    ]);
  });
});
