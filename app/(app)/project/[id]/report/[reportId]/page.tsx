import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { ReportDetailView } from "./ReportDetailView";
import { db } from "@/lib/db";

export const metadata = {
  title: "Report Detail | KG Qualify",
};

type ReportDetailPageProps = {
  params: Promise<{ id: string; reportId: string }>;
};

export default async function ReportDetailPage({
  params,
}: ReportDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id, reportId } = await params;
    redirect(`/login?callbackUrl=/project/${id}/report/${reportId}`);
  }

  const { id, reportId } = await params;
  const project = await ProjectModel.findByIdForUser({
    projectId: id,
    userId: session.user.id,
  });

  if (!project) {
    notFound();
  }

  const artifact = await db.diligenceArtifact.findFirst({
    where: {
      id: reportId,
      projectId: id,
      userId: session.user.id,
    },
    select: {
      id: true,
      type: true,
      stage: true,
      storageProvider: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      metadata: true,
      createdAt: true,
      job: {
        select: {
          id: true,
          status: true,
          selectedProvider: true,
          selectedModel: true,
          tokenUsageTotal: true,
          estimatedCostUsd: true,
          completedAt: true,
        },
      },
    },
  });

  if (!artifact) {
    notFound();
  }

  const { labels } = getLabelsForLocale(session.user.locale ?? "en");

  return (
    <ReportDetailView
      projectId={project.id}
      projectName={project.name}
      artifact={artifact}
      labels={labels.app.reports}
    />
  );
}
