import { Resend } from "resend";

let resendClient: Resend | null = null;

function hasConfiguredValue(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith("replace-with-"));
}

export function isEmailConfigured(): boolean {
  return hasConfiguredValue(process.env.RESEND_API_KEY);
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!hasConfiguredValue(apiKey)) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

type SendEmailArgs = Parameters<Resend["emails"]["send"]>;

export const resend = {
  emails: {
    send(...args: SendEmailArgs) {
      return getResend().emails.send(...args);
    },
  },
} as Resend;

// The verified sending domain — update once a custom domain is verified in Resend.
// For now uses Resend's shared domain for testing.
export const FROM_ADDRESS = "Freakout <general@freakout.ai>";

export function getAppUrl(): string {
  return process.env.AUTH_URL ?? "https://localhost:3000";
}
