import { LuNetwork } from "react-icons/lu";
import { SettingsSectionHeader } from "../SettingsSectionHeader";
import { getActiveFirmSummary } from "@/lib/actions/firm";
import { disableGraph, enableGraph, listAvailableGraphs } from "@/lib/actions/graph";
import { getLabelsForLocale } from "@/labels";

export const metadata = {
  title: "Workflows | Freakout.lol",
};

export default async function WorkflowSettingsPage() {
  const { labels } = getLabelsForLocale("en");
  const [firm, availableGraphs] = await Promise.all([
    getActiveFirmSummary(),
    listAvailableGraphs(),
  ]);
  const t = labels.app.graphWorkflow;

  return (
    <div className="max-w-3xl">
      <SettingsSectionHeader
        icon={<LuNetwork className="h-4 w-4" aria-hidden="true" />}
        title={t.enabledGraphsHeading}
        description={t.enabledGraphsDescription}
      />

      {firm?.permissions.includes("graphs.enable") ? (
        <div className="space-y-2">
          {availableGraphs.length === 0 ? (
            <p className="rounded-lg border border-divider bg-content1 p-4 text-sm text-foreground/55">
              {t.noGraphsAvailable}
            </p>
          ) : (
            availableGraphs.map((graph) => (
              <div
                key={graph.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-divider bg-content1 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {graph.name}
                    </p>
                    {graph.isEnabledForFirm && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        {t.enabledBadge}
                      </span>
                    )}
                  </div>
                  {graph.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-foreground/60">
                      {graph.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-foreground/40">
                    {graph.requirementCount} {t.requirementsCount}
                  </p>
                </div>
                {graph.isEnabledForFirm ? (
                  <form
                    action={async () => {
                      "use server";
                      await disableGraph(graph.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="shrink-0 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-content2"
                    >
                      {t.disableCta}
                    </button>
                  </form>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await enableGraph(graph.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {t.enableCta}
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-divider bg-content1 p-4 text-sm text-foreground/55">
          {t.noGraphsAvailable}
        </p>
      )}
    </div>
  );
}
