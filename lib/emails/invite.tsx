/**
 * Firm invitation email template.
 * Rendered server-side via @react-email/render.
 */

import * as React from "react";

type InviteEmailProps = {
  firmName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
};

export function InviteEmail({
  firmName,
  inviterName,
  role,
  acceptUrl,
  expiresInDays,
}: InviteEmailProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>You've been invited to {firmName} on KG Qualify</title>
      </head>
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: "#f9fafb",
          margin: 0,
          padding: "40px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "40px 36px",
          }}
        >
          {/* Logo / wordmark */}
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 32px",
            }}
          >
            KG Qualify
          </p>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#111827",
              margin: "0 0 12px",
              lineHeight: 1.3,
            }}
          >
            You've been invited to join {firmName}
          </h1>

          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 8px" }}>
            <strong style={{ color: "#374151" }}>{inviterName}</strong> has
            invited you to join <strong style={{ color: "#374151" }}>{firmName}</strong>{" "}
            on KG Qualify as a{" "}
            <strong style={{ color: "#374151" }}>{role.toLowerCase()}</strong>.
          </p>

          <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 32px" }}>
            This invitation expires in {expiresInDays} day{expiresInDays !== 1 ? "s" : ""}.
          </p>

          {/* CTA button */}
          <a
            href={acceptUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#f97316",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              borderRadius: 8,
              padding: "12px 28px",
              marginBottom: 32,
            }}
          >
            Accept invitation
          </a>

          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 4px" }}>
            Or copy and paste this link into your browser:
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#6b7280",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {acceptUrl}
          </p>

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #e5e7eb",
              margin: "32px 0 24px",
            }}
          />

          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            If you weren't expecting this invitation, you can safely ignore this
            email. The link will expire automatically.
          </p>
        </div>
      </body>
    </html>
  );
}

export function inviteEmailText({
  firmName,
  inviterName,
  role,
  acceptUrl,
  expiresInDays,
}: InviteEmailProps): string {
  return [
    `You've been invited to join ${firmName} on KG Qualify`,
    "",
    `${inviterName} has invited you to join ${firmName} as a ${role.toLowerCase()}.`,
    `This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? "s" : ""}.`,
    "",
    `Accept your invitation: ${acceptUrl}`,
    "",
    "If you weren't expecting this, you can safely ignore this email.",
  ].join("\n");
}
