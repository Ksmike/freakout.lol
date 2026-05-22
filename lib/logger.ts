/**
 * Structured logger.
 *
 * In production: emits JSON lines to stdout (Vercel log drain compatible)
 * and forwards to Sentry via Sentry.logger.* (requires enableLogs: true).
 *
 * In development: readable console output.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("upload.started", { projectId, userId, filename, sizeBytes });
 *   logger.error("upload.failed", { projectId, userId }, error);
 */

import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, string | number | boolean | null | undefined>;

const isDev = process.env.NODE_ENV !== "production";

function emit(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  context: LogContext,
  error?: unknown
): void {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...context,
    ...(error instanceof Error
      ? { error_message: error.message, error_name: error.name }
      : {}),
  };

  if (isDev) {
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(`[${level.toUpperCase()}] ${event}`, context, error ?? "");
  } else {
    // JSON line — Vercel captures stdout as structured logs
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  // Forward to Sentry structured logs (v10 enableLogs feature)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentryAttrs = context as Record<string, any>;
  switch (level) {
    case "debug":
      Sentry.logger.debug(event, sentryAttrs);
      break;
    case "info":
      Sentry.logger.info(event, sentryAttrs);
      break;
    case "warn":
      Sentry.logger.warn(event, sentryAttrs);
      if (error instanceof Error) Sentry.captureException(error, { extra: { event, ...context } });
      break;
    case "error":
      Sentry.logger.error(event, sentryAttrs);
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: { event, ...context } });
      } else {
        Sentry.captureMessage(event, { level: "error", extra: context });
      }
      break;
  }
}

export const logger = {
  debug: (event: string, context: LogContext = {}) =>
    emit("debug", event, context),
  info: (event: string, context: LogContext = {}) =>
    emit("info", event, context),
  warn: (event: string, context: LogContext = {}, error?: unknown) =>
    emit("warn", event, context, error),
  error: (event: string, context: LogContext = {}, error?: unknown) =>
    emit("error", event, context, error),
};

/**
 * Generates a short request ID for correlating logs across a single request.
 * Format: 8 hex chars — short enough to include in every log line.
 */
export function generateRequestId(): string {
  return Math.random().toString(16).slice(2, 10);
}
