import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLabelsForLocale } from "@/labels";
import { ProjectModel } from "@/lib/models/ProjectModel";
import { renderOutputDraft } from "@/lib/diligence/draft-renderer";
import { DraftView } from "./DraftView";

export const metadata = {
  title: "Output Draft | KG Qualify",
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
