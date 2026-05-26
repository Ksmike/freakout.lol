import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Register | Freakout.lol",
};

type RegisterPageProps = {
  searchParams?: Promise<{ invite?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const inviteToken = params?.invite ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {inviteToken
              ? "Complete your registration to accept the invitation."
              : "Get started with Freakout"}
          </p>
        </div>
        <RegisterForm inviteToken={inviteToken} />
      </div>
    </div>
  );
}
