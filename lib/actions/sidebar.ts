"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiligenceJobStatus } from "@/lib/generated/prisma/client";
import { ProjectModel } from "@/lib/models/ProjectModel";

export type RecentProject = {
  id: string;
  name: string;
};

export async function getRecentProjects(): Promise<RecentProject[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, name: true },
  });

  return projects;
}

export async function getProjectForSidebar(
  projectId: string
): Promise<{
  id: string;
  name: string;
  hasInsights: boolean;
  hasReports: boolean;
  hasEnquiries: boolean;
  hasDraft: boolean;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const project = await ProjectModel.findByIdForUser({
    projectId,
    userId: session.user.id,
  });
  if (!project) return null;

  const [insightRecord, reportRecord, completedReportRecord, draftRecord] = await Promise.all([
    db.diligenceJob.findFirst({
      where: {
        projectId: project.id,
        userId: session.user.id,
        status: DiligenceJobStatus.COMPLETED,
        OR: [
          { findings: { some: {} } },
          { claims: { some: {} } },
          { entities: { some: {} } },
          { contradictions: { some: {} } },
        ],
      },
      select: { id: true },
    }),
    db.diligenceArtifact.findFirst({
      where: {
        projectId: project.id,
        userId: session.user.id,
        type: {
          in: ["GENERATED_REPORT", "EXPORT_BUNDLE", "EVIDENCE_MAP"],
        },
      },
      select: { id: true },
    }),
    db.diligenceArtifact.findFirst({
      where: {
        projectId: project.id,
        userId: session.user.id,
        type: "GENERATED_REPORT",
        job: {
          status: DiligenceJobStatus.COMPLETED,
        },
      },
      select: { id: true },
    }),
    // Draft is available when the project has an assistance goal + a completed job
    db.assistanceGoal.findUnique({
      where: { projectId: project.id },
      select: { projectId: true },
    }).then(async (goal) => {
      if (!goal) return null;
      return db.diligenceJob.findFirst({
        where: { projectId: project.id, userId: session.user.id, status: DiligenceJobStatus.COMPLETED },
        select: { id: true },
      });
    }),
  ]);

  return {
    id: project.id,
    name: project.name,
    hasInsights: Boolean(insightRecord),
    hasReports: Boolean(reportRecord),
    hasEnquiries: Boolean(completedReportRecord),
    hasDraft: Boolean(draftRecord),
  };
}
