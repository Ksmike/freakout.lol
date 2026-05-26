"use client";

import { oauthSignIn } from "@/lib/actions/auth";
import { LuLinkedin } from "react-icons/lu";
import { useTransition } from "react";

export function LinkedInButton({ label = "Continue with LinkedIn" }: { label?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => oauthSignIn("linkedin"))}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-divider bg-content1 px-4 py-2 text-sm font-medium text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      <LuLinkedin aria-hidden="true" className="size-4" />
      {pending ? "Redirecting..." : label}
    </button>
  );
}
