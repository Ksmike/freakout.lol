import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { DiligenceJobModel } from "@/lib/models/DiligenceJobModel";
import { EnquiriesView } from "./EnquiriesView";
import { checkSubscriptionAccess } from "@/lib/authz/subscription-gate";
import { PaywallOverlay } from "@/components/PaywallOverlay";

export const metadata = {
  title: "Enquiries | Freakout.lol",
};

type EnquiriesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EnquiriesPage({ params }: EnquiriesPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/project/${id}/enquiries`);
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
            {labels.app.enquiries.heading}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {project.name} — {labels.app.enquiries.description}
          </p>
        </div>
        <PaywallOverlay labels={labels.app.paywall} />
      </div>
    );
  }

  const reports = await DiligenceJobModel.getReportsForProject({
    projectId: project.id,
    userId: session.user.id,
  });
  const hasFinishedReport = reports.some(
    (report) => report.type === "GENERATED_REPORT" && report.jobStatus === "COMPLETED"
  );

  if (!hasFinishedReport) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-3 overflow-x-hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {labels.app.enquiries.heading}
        </h1>
        <p className="text-sm text-foreground/70">
          {project.name} - {labels.app.enquiries.description}
        </p>
        <div className="rounded-xl border border-divider bg-content1 p-4">
          <p className="text-sm font-medium text-foreground">
            {labels.app.enquiries.lockedTitle}
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            {labels.app.enquiries.lockedDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <EnquiriesView
      projectId={project.id}
      projectName={project.name}
      labels={labels.app.enquiries}
    />
  );
}
