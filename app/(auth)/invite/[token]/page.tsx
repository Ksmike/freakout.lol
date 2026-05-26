import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { InvitationModel } from "@/lib/models/InvitationModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { AuditAction } from "@/lib/generated/prisma/client";
import Link from "next/link";
import { LuCircleCheck, LuTriangleAlert } from "react-icons/lu";

export const metadata = {
  title: "Accept Invitation | Freakout.lol",
};

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  // Validate the token first (before auth check) so we can show a useful error
  const invite = await InvitationModel.findByToken(token);

  if (!invite) {
    return <InviteError message="This invitation link is invalid or has already been used." />;
  }
  if (invite.acceptedAt) {
    return <InviteError message="This invitation has already been accepted." />;
  }
  if (invite.expiresAt < new Date()) {
    return <InviteError message="This invitation has expired. Ask your team admin to send a new one." />;
  }

  // Require authentication — redirect to register with the token as a callback
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/register?invite=${token}`);
  }

  // Accept the invite
  const result = await InvitationModel.accept(token, session.user.id);

  if ("error" in result) {
    return <InviteError message={result.error ?? "Something went wrong."} />;
  }

  // Write audit log
  await AuditLogModel.record({
    firmId: result.firmId,
    actorUserId: session.user.id,
    action: AuditAction.FIRM_MEMBER_ADDED,
    targetType: "FirmMembership",
    targetId: session.user.id,
    metadata: { via: "invitation", email: session.user.email },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <LuCircleCheck className="size-7 text-success" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            You&apos;re in
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            You&apos;ve joined <strong className="text-foreground">{result.firmName}</strong> on Freakout.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/15">
            <LuTriangleAlert className="size-7 text-danger" aria-hidden="true" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Invitation unavailable
          </h1>
          <p className="mt-2 text-sm text-foreground/60">{message}</p>
        </div>
        <Link
          href="/login"
          className="inline-block w-full rounded-md border border-divider px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-content2"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
