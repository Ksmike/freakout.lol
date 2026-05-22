"use client";

import { useState, useActionState } from "react";
import { register } from "@/lib/actions/auth";
import Link from "next/link";
import { LuCircleCheck, LuCircle } from "react-icons/lu";

type PasswordCriteria = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
};

function evaluatePassword(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
}

const CRITERIA_LABELS: { key: keyof PasswordCriteria; label: string }[] = [
  { key: "minLength", label: "At least 8 characters" },
  { key: "hasUppercase", label: "One uppercase letter" },
  { key: "hasLowercase", label: "One lowercase letter" },
  { key: "hasNumber", label: "One number" },
  { key: "hasSymbol", label: "One symbol" },
];

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);

  const criteria = evaluatePassword(password);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      return await register(formData);
    },
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Jane Doe"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (!passwordTouched) setPasswordTouched(true);
          }}
          className="w-full rounded-md border border-divider bg-content1 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="••••••••"
        />
        {passwordTouched && (
          <ul className="mt-1.5 space-y-1">
            {CRITERIA_LABELS.map(({ key, label }) => {
              const met = criteria[key];
              return (
                <li
                  key={key}
                  className={`flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-danger"}`}
                >
                  {met ? (
                    <LuCircleCheck aria-hidden="true" className="size-3.5" />
                  ) : (
                    <LuCircle aria-hidden="true" className="size-3.5" />
                  )}
                  {label}
                </li>
              );
            })}
          </ul>
        )}
        {!passwordTouched && (
          <p className="text-xs text-foreground/60">
            Use at least 8 characters with uppercase, lowercase, number, and
            symbol.
          </p>
        )}
      </div>

      {/* Terms & Privacy */}
      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="acceptedTerms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            required
            className="mt-0.5 size-4 shrink-0 rounded border-divider accent-primary"
            aria-describedby="terms-description"
          />
          <span id="terms-description" className="text-sm text-foreground/70 leading-snug">
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline" target="_blank">
              Privacy Policy
            </Link>
          </span>
        </label>

        {/* Email opt-in */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="emailOptIn"
            checked={emailOptIn}
            onChange={(e) => setEmailOptIn(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-divider accent-primary"
          />
          <span className="text-sm text-foreground/70 leading-snug">
            Send me product news and updates
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || !acceptedTerms}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
