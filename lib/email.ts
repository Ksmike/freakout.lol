import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// The verified sending domain — update once a custom domain is verified in Resend.
// For now uses Resend's shared domain for testing.
export const FROM_ADDRESS = "Freakout <general@freakout.ai>";

export function getAppUrl(): string {
  return process.env.AUTH_URL ?? "https://localhost:3000";
}
