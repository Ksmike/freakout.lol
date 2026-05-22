import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { DiligenceJobModel } from "@/lib/models/DiligenceJobModel";
import { InsightsView } from "./InsightsView";

export const metadata = {
  title: "Insights | KG Qualify",
};

type InsightsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InsightsPage({ params }: InsightsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/project/${id}/insights`);
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
  const data = await DiligenceJobModel.getFullInsightsForProject({
    projectId: project.id,
    userId: session.user.id,
  });

  return (
    <InsightsView
      projectName={project.name}
      labels={labels.app.insights}
      data={data}
    />
  );
}
