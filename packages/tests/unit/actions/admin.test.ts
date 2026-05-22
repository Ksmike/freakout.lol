import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "../../mocks/db";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const { updateUserSystemRole } = await import("@/lib/actions/admin");
const { revalidatePath } = await import("next/cache");

describe("updateUserSystemRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Property 4: updateUserSystemRole rejects all non-admin callers
  // Validates: Requirements 4.4
  const NON_ADMIN_ROLES = ["USER", undefined, null, ""] as const;

  it.each(NON_ADMIN_ROLES)(
    "returns Unauthorized for caller with systemRole=%s",
    async (role) => {
      mockAuth.mockResolvedValue({ user: { id: "caller-id", systemRole: role } });

      const result = await updateUserSystemRole("target-id", "ADMIN");

      expect(result).toEqual({ error: "Unauthorized" });
      expect(mockDb.user.update).not.toHaveBeenCalled();
    }
  );

  it("returns Unauthorized when session is null (unauthenticated)", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateUserSystemRole("target-id", "ADMIN");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("returns error when admin tries to change their own role (self-demotion)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-id", systemRole: "ADMIN" },
    });

    const result = await updateUserSystemRole("admin-id", "USER");

    expect(result).toEqual({ error: "You cannot change your own system role." });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("updates user role and revalidates path when admin promotes another user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-id", systemRole: "ADMIN" },
    });
    mockDb.user.update.mockResolvedValue({ id: "target-id", systemRole: "ADMIN" });

    const result = await updateUserSystemRole("target-id", "ADMIN");

    expect(result).toEqual({});
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "target-id" },
      data: { systemRole: "ADMIN" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("updates user role and revalidates path when admin demotes another user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-id", systemRole: "ADMIN" },
    });
    mockDb.user.update.mockResolvedValue({ id: "target-id", systemRole: "USER" });

    const result = await updateUserSystemRole("target-id", "USER");

    expect(result).toEqual({});
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "target-id" },
      data: { systemRole: "USER" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});
