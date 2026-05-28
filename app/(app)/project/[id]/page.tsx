import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { ProjectDocumentsPanel } from "@/app/(app)/project/[id]/ProjectDocumentsPanel";
import { ProjectHeader } from "@/app/(app)/project/[id]/ProjectHeader";
import { DeleteProjectButton } from "@/app/(app)/project/[id]/DeleteProjectButton";
import { GraphPanel } from "@/app/(app)/project/[id]/GraphPanel";
import { getApiKeyStatuses } from "@/lib/actions/apiKeys";
import { DiligenceJobModel } from "@/lib/models/DiligenceJobModel";
import { getProjectGoalWithRequirements, getProjectGaps, getProjectMappings } from "@/lib/actions/graph";

export const metadata = {
  title: "Project | Freakout.lol",
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
  const [diligenceJob, graphGoal, diligenceSnapshots] = await Promise.all([
    DiligenceJobModel.findLatestWithStagesForProject({
      projectId: project.id,
      userId: session.user.id,
    }),
    getProjectGoalWithRequirements(project.id),
    DiligenceJobModel.getCompletedSnapshotsForProject({
      projectId: project.id,
      userId: session.user.id,
    }),
  ]);
  const [gaps, mappings] = graphGoal
    ? await Promise.all([
        getProjectGaps(project.id),
        getProjectMappings(project.id),
      ])
    : [[], []];
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
        diligenceSnapshots={diligenceSnapshots}
        labels={labels.app.projectInspect}
      />

      {/* Graph evidence gaps panel */}
      {graphGoal && labels.app.graphWorkflow && (
        <GraphPanel
          projectId={project.id}
          graphName={graphGoal.graph.name}
          gaps={gaps}
          mappings={mappings}
          labels={labels.app.graphWorkflow}
        />
      )}

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
