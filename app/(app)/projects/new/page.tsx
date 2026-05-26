import { getLabelsForLocale } from "@/labels";
import { auth } from "@/lib/auth";
import { createProject } from "@/lib/actions/project";
import { listEnabledGraphs } from "@/lib/actions/graph";
import { LuNetwork, LuTriangleAlert } from "react-icons/lu";

export const metadata = {
  title: "Create Project | Freakout.lol",
};

export default async function ProjectCreationPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const { labels } = getLabelsForLocale(session?.user?.locale ?? "en");
  const projectLabels = labels.app.projectCreation;

  const [enabledGraphs, resolvedParams] = await Promise.all([
    listEnabledGraphs(),
    searchParams,
  ]);

  const errorMessage = resolvedParams?.error
    ? decodeURIComponent(resolvedParams.error)
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {projectLabels.heading}
        </h1>
        <p className="mt-2 text-foreground/70">{projectLabels.description}</p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form
        action={createProject}
        className="space-y-5 rounded-xl border border-divider bg-content1 p-6"
      >
        {/* Project name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            {projectLabels.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={projectLabels.namePlaceholder}
          />
        </div>

        {/* Assistance goal selection */}
        {enabledGraphs.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {projectLabels.assistanceGoalLabel}
            </label>
            <p className="text-xs text-foreground/60">
              {projectLabels.assistanceGoalHint}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {/* No goal option */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-divider bg-background p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="graphId"
                  value=""
                  defaultChecked
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {projectLabels.noGoalLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/60">
                    {projectLabels.noGoalHint}
                  </p>
                </div>
              </label>

              {enabledGraphs.map((graph) => (
                <label
                  key={graph.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-divider bg-background p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="graphId"
                    value={graph.id}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <LuNetwork
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-medium text-foreground">
                        {graph.name}
                      </p>
                    </div>
                    {graph.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground/60">
                        {graph.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-foreground/40">
                      {graph.requirementCount} requirements
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {projectLabels.submitCta}
        </button>
      </form>
    </div>
  );
}
