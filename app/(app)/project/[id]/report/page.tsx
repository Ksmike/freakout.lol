import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { DiligenceJobModel } from "@/lib/models/DiligenceJobModel";
import { ReportsView } from "./ReportsView";

export const metadata = {
  title: "Reports | KG Qualify",
};

type ReportsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportsPage({ params }: ReportsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/project/${id}/report`);
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
  const reports = await DiligenceJobModel.getReportsForProject({
    projectId: project.id,
    userId: session.user.id,
  });

  return (
    <ReportsView
      projectId={project.id}
      projectName={project.name}
      labels={labels.app.reports}
      reports={reports}
    />
  );
}
