import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { ProjectDocumentsPanel } from "@/app/(app)/project/[id]/ProjectDocumentsPanel";
import { ProjectHeader } from "@/app/(app)/project/[id]/ProjectHeader";
import { DeleteProjectButton } from "@/app/(app)/project/[id]/DeleteProjectButton";
import { getApiKeyStatuses } from "@/lib/actions/apiKeys";
import { DiligenceJobModel } from "@/lib/models/DiligenceJobModel";

export const metadata = {
  title: "Project | KG Qualify",
};

type ProjectInspectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectInspectPage({
  params,
}: ProjectInspectPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/project/${id}`);
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
  const apiKeyStatuses = await getApiKeyStatuses();
  const hasAnyApiKeys = apiKeyStatuses.some(
    (status) => status.isSet && status.enabled
  );
  const diligenceJob = await DiligenceJobModel.findLatestWithStagesForProject({
    projectId: project.id,
    userId: session.user.id,
  });
  const insights =
    project.status === "reviewed" || project.status === "complete"
      ? await DiligenceJobModel.getInsightsForProject({
          projectId: project.id,
          userId: session.user.id,
        })
      : null;
  const formattedCreatedAt = new Intl.DateTimeFormat(session.user.locale ?? "en", {
    dateStyle: "medium",
  }).format(project.createdAt);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 overflow-x-hidden">
      <ProjectHeader
        projectName={project.name}
        projectId={project.id}
        projectStatus={project.status}
        projectStatusLabel={labels.app.dashboard.statuses[project.status]}
        createdAtLabel={formattedCreatedAt}
        labels={labels.app.projectInspect}
      />

      <ProjectDocumentsPanel
        projectId={project.id}
        projectStatus={project.status}
        hasAnyApiKeys={hasAnyApiKeys}
        apiKeyStatuses={apiKeyStatuses}
        diligenceJob={diligenceJob}
        insights={insights}
        labels={labels.app.projectInspect}
      />

      <div className="flex justify-end pt-2">
        <DeleteProjectButton
          projectId={project.id}
          labels={{
            deleteProjectCta: labels.app.projectInspect.deleteProjectCta,
            deleteProjectConfirm: labels.app.projectInspect.deleteProjectConfirm,
            deleteProjectInProgress: labels.app.projectInspect.deleteProjectInProgress,
            deleteProjectSuccessToast: labels.app.projectInspect.deleteProjectSuccessToast,
            deleteProjectErrorToast: labels.app.projectInspect.deleteProjectErrorToast,
          }}
        />
      </div>
    </div>
  );
}
