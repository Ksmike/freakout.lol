import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLabelsForLocale } from "@/labels";
import { listAllGraphs, publishGraph, deprecateGraph } from "@/lib/actions/graph";
import { LuNetwork, LuCircleCheck, LuArchive, LuPencil } from "react-icons/lu";

export const metadata = {
  title: "Graph Studio | KG Qualify",
};

export default async function GraphStudioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/graphs");
  }

  const { labels } = getLabelsForLocale(session.user.locale ?? "en");
  const t = labels.app.graphWorkflow;
  const graphs = await listAllGraphs();

  const statusColors: Record<string, string> = {
    DRAFT: "bg-default/10 text-foreground/50",
    PUBLISHED: "bg-success/10 text-success",
    DEPRECATED: "bg-danger/10 text-danger",
  };

  const statusLabels: Record<string, string> = {
    DRAFT: t.adminStatusDraft,
    PUBLISHED: t.adminStatusPublished,
    DEPRECATED: t.adminStatusDeprecated,
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden">
      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LuNetwork className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.adminHeading}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t.adminDescription}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t.adminGraphsHeading}
        </h2>

        <div className="space-y-3">
          {graphs.map((graph) => (
            <div
              key={graph.id}
              className="rounded-xl border border-divider bg-content1 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{graph.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[graph.status] ?? statusColors.DRAFT}`}
                    >
                      {statusLabels[graph.status] ?? graph.status}
                    </span>
                    <span className="text-xs text-foreground/40">v{graph.version}</span>
                  </div>
                  {graph.description && (
                    <p className="mt-1 text-sm text-foreground/60">{graph.description}</p>
                  )}
                  <p className="mt-1.5 text-xs text-foreground/40">
                    {graph.requirementCount} requirements · slug: {graph.slug}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {graph.status === "DRAFT" && (
                    <form
                      action={async () => {
                        "use server";
                        await publishGraph(graph.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-opacity hover:opacity-80"
                      >
                        <LuCircleCheck className="size-3.5" aria-hidden="true" />
                        {t.adminPublishCta}
                      </button>
                    </form>
                  )}
                  {graph.status === "PUBLISHED" && (
                    <form
                      action={async () => {
                        "use server";
                        await deprecateGraph(graph.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-content2"
                      >
                        <LuArchive className="size-3.5" aria-hidden="true" />
                        {t.adminDeprecateCta}
                      </button>
                    </form>
                  )}
                  {graph.status === "DEPRECATED" && (
                    <span className="flex items-center gap-1.5 text-xs text-foreground/40">
                      <LuPencil className="size-3.5" aria-hidden="true" />
                      Deprecated
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
