import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This config is used by middleware (Edge Runtime) — no Prisma imports here.
// The authorize logic and jwt/session callbacks are in lib/auth.ts (Node.js runtime).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    // Credentials needs to be listed here for middleware to recognize it,
    // but the actual authorize function is in lib/auth.ts
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      // This won't be called from middleware — it's a placeholder
      authorize: () => null,
    }),
  ],
} satisfies NextAuthConfig;
