import type { AppLabels } from "@/labels/types";
import { appLabels } from "@/labels/en/app";
import { marketingLabels } from "@/labels/en/marketing";

export const enLabels: AppLabels = {
  marketing: marketingLabels,
  docs: {
    heading: "Documentation",
    description:
      "Architecture, database structure, delivery notes, and production planning for Freakout.",
    sidebarEyebrow: "Repo Docs",
    indexEyebrow: "Overview",
    indexHeading: "Project documentation",
    indexDescription:
      "Browse the markdown files from the repository docs folder in a public, navigable docs view.",
    allDocsCta: "All docs",
    sourceLabel: "Source file",
    noSummaryFallback: "Open this document to review the full content.",
  },
  app: appLabels,
};
