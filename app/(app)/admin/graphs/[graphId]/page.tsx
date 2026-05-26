import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  LuArrowLeft,
  LuCircleCheck,
  LuArchive,
  LuNetwork,
} from "react-icons/lu";
import { getGraphDetail, publishGraph, deprecateGraph } from "@/lib/actions/graph";
import { GraphCanvas } from "./GraphCanvas";
import { isPlatformAdmin } from "@/lib/authz/platform-admin";

export const metadata = {
  title: "Graph Studio | Freakout.lol",
};

type Props = {
  params: Promise<{ graphId: string }>;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-default/10 text-foreground/50",
  PUBLISHED: "bg-success/10 text-success",
  DEPRECATED: "bg-danger/10 text-danger",
};

export default async function GraphDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    const { graphId } = await params;
    redirect(`/login?callbackUrl=/admin/graphs/${graphId}`);
  }
  if (!isPlatformAdmin(session.user.systemRole)) {
    redirect("/dashboard");
  }

  const { graphId } = await params;
  const graph = await getGraphDetail(graphId);
  if (!graph) notFound();

  const requirements = graph.evidenceRequirements.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    nodeId: r.nodeId,
  }));

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-divider bg-content1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin/graphs"
            className="flex items-center gap-1 text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            <LuArrowLeft className="size-4" aria-hidden="true" />
            Graphs
          </Link>
          <div className="h-4 w-px bg-divider" />
          <LuNetwork className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h1 className="truncate text-sm font-semibold text-foreground">{graph.name}</h1>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[graph.status] ?? STATUS_BADGE.DRAFT}`}>
            {graph.status.toLowerCase()}
          </span>
          <span className="text-xs text-foreground/40">v{graph.version}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <span className="text-xs text-foreground/40">
            {graph.nodes.length} nodes · {graph._count.evidenceRequirements} requirements
          </span>
          {graph.status === "DRAFT" && (
            <form action={async () => { "use server"; await publishGraph(graphId); }}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-opacity hover:opacity-80"
              >
                <LuCircleCheck className="size-3.5" aria-hidden="true" />
                Publish
              </button>
            </form>
          )}
          {graph.status === "PUBLISHED" && (
            <form action={async () => { "use server"; await deprecateGraph(graphId); }}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-content2"
              >
                <LuArchive className="size-3.5" aria-hidden="true" />
                Deprecate
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <GraphCanvas
          graphId={graph.id}
          graphStatus={graph.status}
          initialNodes={graph.nodes.map((n) => ({
            id: n.id,
            slug: n.slug,
            label: n.label,
            kind: n.kind,
            description: n.description,
          }))}
          initialEdges={graph.edges.map((e) => ({
            id: e.id,
            sourceId: e.sourceId,
            targetId: e.targetId,
            kind: e.kind,
          }))}
          initialRequirements={requirements}
        />
      </div>
    </div>
  );
}
