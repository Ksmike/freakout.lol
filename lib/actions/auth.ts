"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";

const PASSWORD_HASH_COST = 14;
const PASSWORD_MIN_LENGTH = 8;
const REGISTER_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_MAX = 12;
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.";

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }
  return { valid: true, message: "" };
}

export async function register(formData: FormData) {
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = formData.get("password") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim() || null;
  const acceptedTerms = formData.get("acceptedTerms") === "on";
  const emailOptIn = formData.get("emailOptIn") === "on";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (!acceptedTerms) {
    return { error: "You must accept the Terms of Service and Privacy Policy to continue." };
  }

  const registerRateLimit = checkRateLimit({
    namespace: "auth:register",
    identifier: email,
    maxRequests: REGISTER_RATE_LIMIT_MAX,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  });
  if (!registerRateLimit.allowed) {
    return {
      error: `Too many registration attempts. Try again in ${registerRateLimit.retryAfterSeconds} seconds.`,
    };
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.message };
  }

  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, PASSWORD_HASH_COST);

  await db.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      locale: "en",
      notificationPreferences: { email: emailOptIn },
    },
  });

  // Auto sign-in after registration
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  });
}

export async function login(formData: FormData) {
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const loginRateLimit = checkRateLimit({
    namespace: "auth:login",
    identifier: email,
    maxRequests: LOGIN_RATE_LIMIT_MAX,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  });
  if (!loginRateLimit.allowed) {
    return {
      error: `Too many login attempts. Try again in ${loginRateLimit.retryAfterSeconds} seconds.`,
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error: unknown) {
    // next-auth throws a NEXT_REDIRECT "error" on success — rethrow it
    if (
      error instanceof Error &&
      "digest" in error &&
      typeof (error as { digest?: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { error: "Invalid email or password" };
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
