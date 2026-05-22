import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      locale: string;
      systemRole: string;
    } & DefaultSession["user"];
  }

  interface User {
    locale?: string;
    systemRole?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    locale?: string;
    systemRole?: string;
  }
}
