import { getLabelsForLocale } from "@/labels";
import { auth } from "@/lib/auth";
import { createProject } from "@/lib/actions/project";

export const metadata = {
  title: "Create Project | KG Qualify",
};

export default async function ProjectCreationPage() {
  const session = await auth();
  const { labels } = getLabelsForLocale(session?.user?.locale ?? "en");
  const projectLabels = labels.app.projectCreation;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {projectLabels.heading}
        </h1>
        <p className="mt-2 text-foreground/70">{projectLabels.description}</p>
      </div>

      <form
        action={createProject}
        className="space-y-4 rounded-xl border border-divider bg-content1 p-6"
      >
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
