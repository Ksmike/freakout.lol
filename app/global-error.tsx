"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError requires a statusCode prop; App Router doesn't expose
            status codes for errors, so we pass 0 for a generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
