import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockGetActiveFirmSummaryForUser = vi.fn();
const mockListMembers = vi.fn();
const mockAddExistingUserByEmail = vi.fn();
const mockUpdateMemberRole = vi.fn();
vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    getActiveFirmSummaryForUser: mockGetActiveFirmSummaryForUser,
    listMembers: mockListMembers,
    addExistingUserByEmail: mockAddExistingUserByEmail,
    updateMemberRole: mockUpdateMemberRole,
  },
}));

const mockAuditRecord = vi.fn();
const mockAuditListForFirm = vi.fn();
vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: {
    record: mockAuditRecord,
    listForFirm: mockAuditListForFirm,
  },
}));

vi.mock("@/lib/models/BillingModel", () => ({
  BillingModel: {
    checkSeatAvailability: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/active-firm", () => ({
  getActiveFirmIdFromCookie: vi.fn().mockResolvedValue(null),
  setActiveFirmCookie: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/models/InvitationModel", () => ({
  InvitationModel: {
    create: vi.fn(),
    listPendingForFirm: vi.fn().mockResolvedValue([]),
    revoke: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  resend: { emails: { send: vi.fn().mockResolvedValue({ id: "email-1" }) } },
  FROM_ADDRESS: "test@example.com",
  getAppUrl: vi.fn().mockReturnValue("https://localhost:3000"),
}));

vi.mock("@/lib/emails/render-invite", () => ({
  renderInviteEmail: vi.fn().mockResolvedValue("<html>invite</html>"),
}));

vi.mock("@/lib/emails/invite", () => ({
  inviteEmailText: vi.fn().mockReturnValue("invite text"),
}));

const {
  addFirmMemberByEmail,
  getActiveFirmSummary,
  listFirmAuditLogs,
  listFirmMembers,
  updateFirmMemberRole,
} = await import("@/lib/actions/firm");

describe("getActiveFirmSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(getActiveFirmSummary()).resolves.toBeNull();
    expect(mockGetActiveFirmSummaryForUser).not.toHaveBeenCalled();
  });

  it("returns firm details with permissions for the active user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      name: "Acme",
      slug: "acme",
      role: "OWNER",
      plan: "starter",
      billingStatus: "trialing",
    });

    const result = await getActiveFirmSummary();

    expect(result).toMatchObject({
      id: "firm-1",
      name: "Acme",
      slug: "acme",
      role: "OWNER",
      plan: "starter",
      billingStatus: "trialing",
    });
    expect(result?.permissions).toContain("billing.manage");
    expect(result?.permissions).toContain("projects.create");
    expect(mockGetActiveFirmSummaryForUser).toHaveBeenCalledWith("user-1", null);
  });
});

describe("listFirmMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when user lacks permission", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ANALYST",
    });

    await expect(listFirmMembers()).resolves.toEqual([]);
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  it("returns active firm members for admins", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ADMIN",
    });
    mockListMembers.mockResolvedValue([
      {
        id: "member-1",
        role: "ANALYST",
        status: "ACTIVE",
        user: {
          name: "Analyst",
          email: "analyst@example.com",
        },
      },
    ]);

    await expect(listFirmMembers()).resolves.toEqual([
      {
        id: "member-1",
        name: "Analyst",
        email: "analyst@example.com",
        role: "ANALYST",
        status: "ACTIVE",
      },
    ]);
    expect(mockListMembers).toHaveBeenCalledWith("firm-1");
  });
});

describe("listFirmAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when user lacks audit permission", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ANALYST",
    });

    await expect(listFirmAuditLogs()).resolves.toEqual([]);
    expect(mockAuditListForFirm).not.toHaveBeenCalled();
  });

  it("returns audit logs for admins", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ADMIN",
    });
    mockAuditListForFirm.mockResolvedValue([
      {
        id: "audit-1",
        action: "FIRM_MEMBER_ADDED",
        targetType: "FirmMembership",
        targetId: "member-1",
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
        actor: {
          name: "Admin",
          email: "admin@example.com",
        },
      },
    ]);

    await expect(listFirmAuditLogs()).resolves.toEqual([
      {
        id: "audit-1",
        action: "FIRM_MEMBER_ADDED",
        actorLabel: "Admin",
        targetType: "FirmMembership",
        targetId: "member-1",
        createdAt: "2026-05-22T10:00:00.000Z",
      },
    ]);
    expect(mockAuditListForFirm).toHaveBeenCalledWith({
      firmId: "firm-1",
      take: 10,
    });
  });
});

describe("addFirmMemberByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies users without invite permission", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ANALYST",
    });
    const formData = new FormData();

    const result = await addFirmMemberByEmail(formData);

    expect(result).toEqual({
      error: "You do not have permission to invite members.",
    });
    expect(mockAddExistingUserByEmail).not.toHaveBeenCalled();
  });

  it("adds an existing user by email", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ADMIN",
    });
    mockAddExistingUserByEmail.mockResolvedValue({ added: true });
    const formData = new FormData();
    formData.set("email", "New.User@Example.com ");
    formData.set("role", "ANALYST");

    const result = await addFirmMemberByEmail(formData);

    expect(result).toEqual({});
    expect(mockAddExistingUserByEmail).toHaveBeenCalledWith({
      firmId: "firm-1",
      email: "new.user@example.com",
      role: "ANALYST",
    });
    expect(mockAuditRecord).toHaveBeenCalledWith({
      firmId: "firm-1",
      actorUserId: "user-1",
      action: "FIRM_MEMBER_ADDED",
      targetType: "FirmMembership",
      targetId: "new.user@example.com",
      metadata: {
        email: "new.user@example.com",
        role: "ANALYST",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings");
  });
});

describe("updateFirmMemberRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a member role inside the active firm", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGetActiveFirmSummaryForUser.mockResolvedValue({
      firmId: "firm-1",
      role: "ADMIN",
    });
    mockUpdateMemberRole.mockResolvedValue(true);
    const formData = new FormData();
    formData.set("membershipId", "member-1");
    formData.set("role", "REVIEWER");

    const result = await updateFirmMemberRole(formData);

    expect(result).toEqual({});
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      firmId: "firm-1",
      membershipId: "member-1",
      role: "REVIEWER",
    });
    expect(mockAuditRecord).toHaveBeenCalledWith({
      firmId: "firm-1",
      actorUserId: "user-1",
      action: "FIRM_MEMBER_ROLE_UPDATED",
      targetType: "FirmMembership",
      targetId: "member-1",
      metadata: {
        role: "REVIEWER",
      },
    });
  });
});
