import { describe, it, expect, vi } from "vitest";

// Mock dependencies before importing auth
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Capture the config passed to NextAuth so we can test callbacks
let capturedConfig: Record<string, unknown> = {};
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation((config) => {
    capturedConfig = config;
    return {
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn().mockReturnValue({}),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn().mockImplementation((config) => ({
    ...config,
    type: "credentials",
  })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Import auth to trigger NextAuth() call and populate capturedConfig
await import("@/lib/auth");

describe("auth config", () => {
  it("exports handlers, auth, signIn, signOut", async () => {
    const authModule = await import("@/lib/auth");
    expect(authModule.handlers).toBeDefined();
    expect(authModule.auth).toBeDefined();
    expect(authModule.signIn).toBeDefined();
    expect(authModule.signOut).toBeDefined();
  });
});

describe("auth.config", () => {
  it("exports authConfig with signIn page set to /login", async () => {
    const { authConfig } = await import("@/lib/auth.config");
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("authConfig does not define callbacks (they live in lib/auth.ts)", async () => {
    const { authConfig } = await import("@/lib/auth.config");
    // Callbacks moved to lib/auth.ts so they can access the DB (Node.js runtime only)
    expect("callbacks" in authConfig).toBe(false);
  });
});

describe("lib/auth.ts jwt callback", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getJwtCallback = () => (capturedConfig as any).callbacks?.jwt;

  it("writes systemRole from user into token on sign-in", async () => {
    const jwtCallback = getJwtCallback();
    expect(jwtCallback).toBeDefined();

    const token = { sub: "123" };
    const user = { id: "user-1", locale: "en", systemRole: "ADMIN" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await jwtCallback({ token, user } as any);
    expect(result.id).toBe("user-1");
    expect(result.systemRole).toBe("ADMIN");
  });

  it("writes USER systemRole when user.systemRole is undefined", async () => {
    const jwtCallback = getJwtCallback();
    const token = { sub: "123" };
    const user = { id: "user-1", locale: "en" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await jwtCallback({ token, user } as any);
    expect(result.systemRole).toBe("USER");
  });

  it("writes USER systemRole for a regular user", async () => {
    const jwtCallback = getJwtCallback();
    const token = { sub: "123" };
    const user = { id: "user-1", locale: "en", systemRole: "USER" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await jwtCallback({ token, user } as any);
    expect(result.systemRole).toBe("USER");
  });

  it("returns token unchanged when no user (token refresh)", async () => {
    const jwtCallback = getJwtCallback();
    const token = { sub: "123", id: "existing", systemRole: "ADMIN" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await jwtCallback({ token, user: undefined } as any);
    expect(result.id).toBe("existing");
    expect(result.systemRole).toBe("ADMIN");
  });
});

describe("lib/auth.ts session callback", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSessionCallback = () => (capturedConfig as any).callbacks?.session;

  it("copies systemRole from token into session.user", async () => {
    const sessionCallback = getSessionCallback();
    expect(sessionCallback).toBeDefined();

    const session = { user: { id: "", locale: "", systemRole: "" } };
    const token = { id: "user-1", locale: "en", systemRole: "ADMIN" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sessionCallback({ session, token } as any);
    expect(result.user.id).toBe("user-1");
    expect(result.user.systemRole).toBe("ADMIN");
  });

  it("defaults systemRole to USER when token.systemRole is missing", async () => {
    const sessionCallback = getSessionCallback();
    const session = { user: { id: "", locale: "", systemRole: "" } };
    const token = { id: "user-1", locale: "en" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sessionCallback({ session, token } as any);
    expect(result.user.systemRole).toBe("USER");
  });

  it("copies USER systemRole from token into session.user", async () => {
    const sessionCallback = getSessionCallback();
    const session = { user: { id: "", locale: "", systemRole: "" } };
    const token = { id: "user-1", locale: "en", systemRole: "USER" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sessionCallback({ session, token } as any);
    expect(result.user.systemRole).toBe("USER");
  });
});
