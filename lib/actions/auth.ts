"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth, signIn, signOut } from "@/lib/auth";
import {
  clearEmailChangeVerificationToken,
  createEmailChangeVerificationToken,
  createEmailVerificationToken,
  sendEmailChangeVerification,
  sendEmailVerification,
} from "@/lib/email-verification";
import { isEmailConfigured } from "@/lib/email";
import {
  deletePasswordResetToken,
  getPasswordResetTokenStatus,
} from "@/lib/password-reset";
import { normalizeEmail } from "@/lib/utils/email";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SystemRole } from "@/lib/generated/prisma/client";

const PASSWORD_HASH_COST = 14;
const PASSWORD_MIN_LENGTH = 8;
const REGISTER_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_MAX = 12;
const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.";
const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Verify your email before signing in. Check your inbox for the verification link.";
const UNAUTHORIZED_MESSAGE = "Sign in to update your account.";

type AuthActionResult = {
  error?: string;
  success?: string;
};

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
  const email = normalizeEmail(formData.get("email") as string | null);
  const password = formData.get("password") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim() || null;
  const acceptedTerms = formData.get("acceptedTerms") === "on";
  const emailOptIn = formData.get("emailOptIn") === "on";
  const inviteToken = ((formData.get("inviteToken") as string | null) ?? "").trim() || null;

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
  const emailConfigured = isEmailConfigured();
  const isFirstUser = (await db.user.count()) === 0;

  let userCreated = false;
  try {
    await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        emailVerified: emailConfigured ? null : new Date(),
        locale: "en",
        systemRole: isFirstUser ? SystemRole.ADMIN : SystemRole.USER,
        notificationPreferences: { email: emailOptIn },
      },
    });
    userCreated = true;

    if (!emailConfigured) {
      return {
        success:
          "Account created. Email is not configured, so this account is ready to sign in.",
      };
    }

    const verificationToken = await createEmailVerificationToken(email);
    await sendEmailVerification({
      email,
      name,
      token: verificationToken,
      inviteToken,
    });
  } catch (error) {
    if (userCreated) {
      try {
        await db.verificationToken.deleteMany({ where: { identifier: email } });
      } catch {
        // Best-effort cleanup after a failed registration email.
      }
      try {
        await db.user.delete({ where: { email } });
      } catch {
        // Best-effort cleanup after a failed registration email.
      }
    }
    throw error;
  }

  return {
    success:
      "Account created. Check your email to verify your address before signing in.",
  };
}

export async function login(formData: FormData) {
  const email = normalizeEmail(formData.get("email") as string | null);
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

  const user = await db.user.findUnique({
    where: { email },
    select: { password: true, emailVerified: true },
  });
  if (user?.password && !user.emailVerified) {
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      return { error: EMAIL_VERIFICATION_REQUIRED_MESSAGE };
    }
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

export async function requestEmailChange(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: UNAUTHORIZED_MESSAGE };
  }

  const newEmail = normalizeEmail(formData.get("newEmail") as string | null);
  const currentPassword = (formData.get("currentPassword") as string) ?? "";

  if (!newEmail) {
    return { error: "Enter a valid email address." };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
    },
  });

  if (!user) {
    return { error: UNAUTHORIZED_MESSAGE };
  }

  if (newEmail === normalizeEmail(user.email)) {
    return { error: "Enter a different email address." };
  }

  const existingUser = await db.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existingUser && existingUser.id !== user.id) {
    return { error: "An account with this email already exists." };
  }

  if (user.password) {
    if (!currentPassword) {
      return { error: "Enter your current password." };
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatches) {
      return { error: "Current password is incorrect." };
    }
  }

  const verificationToken = await createEmailChangeVerificationToken({
    userId: user.id,
    email: newEmail,
  });

  try {
    await sendEmailChangeVerification({
      email: newEmail,
      currentEmail: user.email,
      name: user.name,
      token: verificationToken,
    });
  } catch (error) {
    await clearEmailChangeVerificationToken({
      userId: user.id,
      email: newEmail,
    }).catch(() => undefined);
    throw error;
  }

  return {
    success:
      "Check your new inbox to confirm this email change. Your current email stays active until then.",
  };
}

export async function requestEmailChangeWithState(
  _previousState: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  return requestEmailChange(formData);
}

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: UNAUTHORIZED_MESSAGE };
  }

  const currentPassword = (formData.get("currentPassword") as string) ?? "";
  const newPassword = (formData.get("newPassword") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Current password, new password, and confirmation are required." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.message };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user?.password) {
    return { error: "Password sign-in is not available for this account." };
  }

  const currentPasswordMatches = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!currentPasswordMatches) {
    return { error: "Current password is incorrect." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
  await db.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  });

  return { success: "Password updated." };
}

export async function changePasswordWithState(
  _previousState: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  return changePassword(formData);
}

export async function resetPasswordWithToken(
  formData: FormData
): Promise<AuthActionResult> {
  const userId = ((formData.get("userId") as string | null) ?? "").trim();
  const token = ((formData.get("token") as string | null) ?? "").trim();
  const newPassword = (formData.get("newPassword") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!userId || !token) {
    return { error: "Password reset link is missing or invalid." };
  }

  if (!newPassword || !confirmPassword) {
    return { error: "New password and confirmation are required." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    return { error: passwordValidation.message };
  }

  const tokenStatus = await getPasswordResetTokenStatus({ userId, token });
  if (tokenStatus === "expired") {
    return { error: "Password reset link has expired." };
  }
  if (tokenStatus !== "valid") {
    return { error: "Password reset link is missing or invalid." };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, emailVerified: true },
  });
  if (!user) {
    await deletePasswordResetToken({ userId, token }).catch(() => undefined);
    return { error: "Password reset link is missing or invalid." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
  await db.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      emailVerified: user.emailVerified ?? new Date(),
    },
  });
  await deletePasswordResetToken({ userId, token });

  return { success: "Password reset. You can sign in with your new password." };
}

export async function resetPasswordWithTokenState(
  _previousState: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  return resetPasswordWithToken(formData);
}

export async function oauthSignIn(provider: string) {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
