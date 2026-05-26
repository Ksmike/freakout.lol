import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

type HeaderUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

export function Header({ user }: { user?: HeaderUser }) {
  return (
    <header className="flex items-center justify-between border-b border-divider bg-background px-4 py-3 sm:px-6 sm:py-4">
      <Link
        href="/"
        className="text-base font-semibold text-foreground sm:text-lg"
      >
        .lol.
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/#workflow"
          className="hidden sm:inline-block text-sm font-medium text-foreground/70 transition-colors hover:text-foreground px-2"
        >
          Workflow
        </Link>
        <Link
          href="/#coverage"
          className="hidden sm:inline-block text-sm font-medium text-foreground/70 transition-colors hover:text-foreground px-2"
        >
          Coverage
        </Link>
        <Link
          href="/docs"
          className="hidden sm:inline-block text-sm font-medium text-foreground/70 transition-colors hover:text-foreground px-2"
        >
          Docs
        </Link>
        <Link
          href="/dashboard"
          className="hidden md:inline-block text-sm font-medium text-foreground/70 transition-colors hover:text-foreground px-2"
        >
          Dashboard
        </Link>

        <ThemeSwitcher />

        {user ? (
          <UserMenu user={user} />
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
