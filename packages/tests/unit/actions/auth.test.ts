import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb } from "../../mocks/db";
import { resetRateLimitBucketsForTests } from "@/lib/security/rate-limit";

const mockResendSend = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "email-1" }));
const mockIsEmailConfigured = vi.hoisted(() => vi.fn(() => true));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}));

// Mock next-auth signIn
const mockAuth = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
  signIn: mockSignIn,
  signOut: mockSignOut,
}));

vi.mock("@/lib/email", () => ({
  FROM_ADDRESS: "test@example.com",
  getAppUrl: vi.fn().mockReturnValue("https://app.example.com"),
  isEmailConfigured: mockIsEmailConfigured,
  resend: { emails: { send: mockResendSend } },
}));

// Import after mocks are set up
const {
  changePassword,
  login,
  logout,
  register,
  requestEmailChange,
  resetPasswordWithToken,
} = await import("@/lib/actions/auth");

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value);
  }
  return formData;
}

describe("register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitBucketsForTests();
    mockDb.user.count.mockResolvedValue(1);
    mockIsEmailConfigured.mockReturnValue(true);
  });

  it("returns error when email is missing", async () => {
    const formData = createFormData({ password: "password123" });
    const result = await register(formData);
    expect(result).toEqual({ error: "Email and password are required" });
  });

  it("returns error when password is missing", async () => {
    const formData = createFormData({ email: "test@example.com" });
    const result = await register(formData);
    expect(result).toEqual({ error: "Email and password are required" });
  });

  it("returns error when password is too short", async () => {
    const formData = createFormData({
      email: "test@example.com",
      password: "short",
      acceptedTerms: "on",
    });
    const result = await register(formData);
    expect(result).toEqual({
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  });

  it("returns error when password misses complexity requirements", async () => {
    const formData = createFormData({
      email: "test@example.com",
      password: "alllowercase123",
      acceptedTerms: "on",
    });
    const result = await register(formData);
    expect(result).toEqual({
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  });

  it("returns error when user already exists", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "1", email: "test@example.com" });

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });
    const result = await register(formData);
    expect(result).toEqual({
      error: "An account with this email already exists",
    });
  });

  it("rate-limits repeated registration attempts", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "1", email: "test@example.com" });

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    await register(formData);
    await register(formData);
    await register(formData);
    await register(formData);
    await register(formData);

    const throttled = await register(formData);
    expect(throttled?.error).toContain("Too many registration attempts");
  });

  it("creates user and sends verification email on success", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      name: "Test User",
    });

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      name: "Test User",
      acceptedTerms: "on",
    });

    const result = await register(formData);

    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: {
        email: "test@example.com",
        name: "Test User",
        password: "hashed_password",
        emailVerified: null,
        locale: "en",
        systemRole: "USER",
        notificationPreferences: { email: false },
      },
    });
    expect(mockDb.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "test@example.com" },
    });
    expect(mockDb.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "test@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "test@example.com",
        to: "test@example.com",
        subject: "Verify your Freakout email",
      })
    );
    expect((await import("bcryptjs")).default.hash).toHaveBeenCalledWith(
      "Password123!",
      14
    );
    expect(result).toEqual({
      success:
        "Account created. Check your email to verify your address before signing in.",
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("sets name to null when not provided", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      name: null,
    });

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    await register(formData);

    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: {
        email: "test@example.com",
        name: null,
        password: "hashed_password",
        emailVerified: null,
        locale: "en",
        systemRole: "USER",
        notificationPreferences: { email: false },
      },
    });
  });

  it("creates the first registered user as a platform admin", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.count.mockResolvedValue(0);
    mockDb.user.create.mockResolvedValue({
      id: "1",
      email: "admin@example.com",
      name: null,
    });

    const formData = createFormData({
      email: "admin@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    await register(formData);

    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "admin@example.com",
        systemRole: "ADMIN",
      }),
    });
  });

  it("allows registration without transactional email configured", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      name: null,
    });
    mockIsEmailConfigured.mockReturnValue(false);

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    const result = await register(formData);

    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailVerified: expect.any(Date),
      }),
    });
    expect(mockDb.verificationToken.create).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(result).toEqual({
      success:
        "Account created. Email is not configured, so this account is ready to sign in.",
    });
  });

  it("rolls back the new user if verification email delivery fails", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      name: null,
    });
    mockResendSend.mockRejectedValueOnce(new Error("Email failed"));

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    await expect(register(formData)).rejects.toThrow("Email failed");
    expect(mockDb.user.delete).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });

  it("does not delete by email when user creation fails before cleanup is safe", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockRejectedValueOnce(new Error("Create failed"));

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
      acceptedTerms: "on",
    });

    await expect(register(formData)).rejects.toThrow("Create failed");
    expect(mockDb.verificationToken.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.user.delete).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitBucketsForTests();
    mockDb.user.findUnique.mockResolvedValue(null);
  });

  it("returns error when email is missing", async () => {
    const formData = createFormData({ password: "password123" });
    const result = await login(formData);
    expect(result).toEqual({ error: "Email and password are required" });
  });

  it("returns error when password is missing", async () => {
    const formData = createFormData({ email: "test@example.com" });
    const result = await login(formData);
    expect(result).toEqual({ error: "Email and password are required" });
  });

  it("calls signIn with credentials", async () => {
    mockSignIn.mockResolvedValue(undefined);

    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    await login(formData);

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "password123",
      redirectTo: "/dashboard",
    });
  });

  it("returns a verification error when credentials match an unverified user", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      password: "hashed_password",
      emailVerified: null,
    });
    vi.mocked((await import("bcryptjs")).default.compare).mockResolvedValue(
      true as never
    );

    const formData = createFormData({
      email: "test@example.com",
      password: "Password123!",
    });

    const result = await login(formData);

    expect(result).toEqual({
      error:
        "Verify your email before signing in. Check your inbox for the verification link.",
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns error on invalid credentials", async () => {
    mockSignIn.mockRejectedValue(new Error("CredentialsSignin"));

    const formData = createFormData({
      email: "test@example.com",
      password: "wrongpassword",
    });

    const result = await login(formData);
    expect(result).toEqual({ error: "Invalid email or password" });
  });

  it("rethrows NEXT_REDIRECT errors", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    Object.assign(redirectError, { digest: "NEXT_REDIRECT;/dashboard" });

    mockSignIn.mockRejectedValue(redirectError);

    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("rate-limits repeated login attempts", async () => {
    mockSignIn.mockRejectedValue(new Error("CredentialsSignin"));
    const formData = createFormData({
      email: "test@example.com",
      password: "password123",
    });

    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);
    await login(formData);

    const throttled = await login(formData);
    expect(throttled?.error).toContain("Too many login attempts");
  });
});

describe("requestEmailChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "user-1", email: "current@example.com" },
    });
  });

  it("requires an authenticated user", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requestEmailChange(
      createFormData({ newEmail: "new@example.com" })
    );

    expect(result).toEqual({ error: "Sign in to update your account." });
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires a different email address", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "current@example.com",
      name: "Current User",
      password: "hashed_password",
    });

    const result = await requestEmailChange(
      createFormData({
        newEmail: "CURRENT@example.com",
        currentPassword: "Password123!",
      })
    );

    expect(result).toEqual({ error: "Enter a different email address." });
  });

  it("requires the current password for credentials accounts", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "current@example.com",
      name: "Current User",
      password: "hashed_password",
    });

    const result = await requestEmailChange(
      createFormData({ newEmail: "new@example.com" })
    );

    expect(result).toEqual({ error: "Enter your current password." });
  });

  it("creates and sends an email-change verification link", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "current@example.com",
        name: "Current User",
        password: "hashed_password",
      })
      .mockResolvedValueOnce(null);
    vi.mocked((await import("bcryptjs")).default.compare).mockResolvedValue(
      true as never
    );

    const result = await requestEmailChange(
      createFormData({
        newEmail: "New@example.com",
        currentPassword: "Password123!",
      })
    );

    expect(mockDb.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "email-change:user-1:new@example.com" },
    });
    expect(mockDb.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "email-change:user-1:new@example.com",
        token: expect.any(String),
        expires: expect.any(Date),
      },
    });
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        subject: "Confirm your Freakout email change",
      })
    );
    expect(result).toEqual({
      success:
        "Check your new inbox to confirm this email change. Your current email stays active until then.",
    });
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "user-1", email: "current@example.com" },
    });
  });

  it("requires an authenticated user", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await changePassword(
      createFormData({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(result).toEqual({ error: "Sign in to update your account." });
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("validates matching new password confirmation", async () => {
    const result = await changePassword(
      createFormData({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        confirmPassword: "OtherPassword123!",
      })
    );

    expect(result).toEqual({
      error: "New password and confirmation do not match.",
    });
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects accounts without password sign-in", async () => {
    mockDb.user.findUnique.mockResolvedValue({ password: null });

    const result = await changePassword(
      createFormData({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(result).toEqual({
      error: "Password sign-in is not available for this account.",
    });
  });

  it("updates the password after validating the current password", async () => {
    mockDb.user.findUnique.mockResolvedValue({ password: "hashed_password" });
    vi.mocked((await import("bcryptjs")).default.compare).mockResolvedValue(
      true as never
    );

    const result = await changePassword(
      createFormData({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed_password" },
    });
    expect(result).toEqual({ success: "Password updated." });
  });
});

describe("resetPasswordWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing reset link data", async () => {
    const result = await resetPasswordWithToken(
      createFormData({
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(result).toEqual({
      error: "Password reset link is missing or invalid.",
    });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects expired reset tokens", async () => {
    mockDb.verificationToken.findUnique.mockResolvedValue({
      identifier: "password-reset:user-1",
      token: "hashed-token",
      expires: new Date(Date.now() - 60_000),
    });

    const result = await resetPasswordWithToken(
      createFormData({
        userId: "user-1",
        token: "raw-token",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(result).toEqual({ error: "Password reset link has expired." });
    expect(mockDb.verificationToken.delete).toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("updates the password and consumes a valid reset token", async () => {
    mockDb.verificationToken.findUnique.mockResolvedValue({
      identifier: "password-reset:user-1",
      token: "hashed-token",
      expires: new Date(Date.now() + 60_000),
    });
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      emailVerified: null,
    });

    const result = await resetPasswordWithToken(
      createFormData({
        userId: "user-1",
        token: "raw-token",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      })
    );

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        password: "hashed_password",
        emailVerified: expect.any(Date),
      },
    });
    expect(mockDb.verificationToken.delete).toHaveBeenCalled();
    expect(result).toEqual({
      success: "Password reset. You can sign in with your new password.",
    });
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signOut with redirect to home", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await logout();
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });
});
