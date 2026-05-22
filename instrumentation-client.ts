import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [Sentry.replayIntegration()],

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
