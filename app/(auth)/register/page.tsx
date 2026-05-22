import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Register | KG Qualify",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Get started with KG Qualify
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
