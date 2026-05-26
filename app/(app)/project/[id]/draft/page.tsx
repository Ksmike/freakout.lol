import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { renderOutputDraft } from "@/lib/diligence/draft-renderer";
import { DraftView } from "./DraftView";
import { checkSubscriptionAccess } from "@/lib/authz/subscription-gate";
import { PaywallOverlay } from "@/components/PaywallOverlay";

export const metadata = {
  title: "Output Draft | Freakout.lol",
};

type DraftPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DraftPage({ params }: DraftPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/project/${id}/draft`);
  }

  const { id } = await params;
  const project = await ProjectModel.findByIdForUser({
    projectId: id,
    userId: session.user.id,
  });

  if (!project) {
    notFound();
  }

  const { labels } = getLabelsForLocale(session.user.locale ?? "en");

  // Check subscription access
  const access = await checkSubscriptionAccess(session.user.systemRole);
  if (!access.hasAccess) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {labels.app.draft.heading}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {project.name} — {labels.app.draft.description}
          </p>
        </div>
        <PaywallOverlay labels={labels.app.paywall} />
      </div>
    );
  }

  const draft = await renderOutputDraft({
    projectId: project.id,
    userId: session.user.id,
  });

  return (
    <DraftView
      projectId={project.id}
      projectName={project.name}
      draft={draft}
      labels={labels.app.draft}
    />
  );
}
