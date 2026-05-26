import type { MarketingLabels } from "@/labels/types";

export const marketingLabels: MarketingLabels = {
  hero: {
    badge: "Open Source",
    title: "Knowledge-graph led data annotation and investigation.",
    description:
      "Define ontologies, upload documents, and let the platform annotate, cross-reference, and surface what matters — with full provenance.",
    trialCta: "Get Started",
    demoCta: "See It in Action",
    segmentLabels: [
      "Due Diligence",
      "Compliance",
      "Research",
      "Vendor Review",
      "Risk Analysis",
      "Investigations",
    ],
  },
  metrics: [
    { label: "Documents annotated per project", value: "100+" },
    { label: "Claims and entities extracted automatically", value: "1,000+" },
    { label: "Outputs traceable to source evidence", value: "100%" },
  ],
  workflow: {
    heading: "How Freakout works",
    steps: [
      {
        title: "Define",
        description:
          "Build a knowledge graph that describes what you need to know — nodes for concepts, edges for relationships, and evidence requirements for each.",
      },
      {
        title: "Annotate",
        description:
          "Upload documents. The platform extracts entities, claims, and evidence, then maps them against your graph to show what's covered and what's missing.",
      },
      {
        title: "Investigate",
        description:
          "Surface contradictions, gaps, and open questions. Generate structured outputs with full provenance back to every source document.",
      },
    ],
  },
  coverage: {
    heading: "Structured investigation you can trust",
    description:
      "Built for workflows where you need to prove what you know, where it came from, and what is still missing.",
    items: [
      "Custom knowledge graphs defined by your team",
      "Evidence requirements mapped to source documents",
      "Gap detection across your entire ontology",
      "Human review before conclusions or submissions",
      "Multi-tenant workspaces for teams and engagements",
      "Every output linked back to source evidence",
    ],
    outcomesTitle: "Why knowledge graphs?",
    outcomesParagraphs: [
      "Scattered documents are hard to reason about. The challenge isn't extraction — it's knowing which evidence satisfies which requirement and what still needs to be gathered.",
      "Freakout turns each investigation into a closed loop: define the graph, upload evidence, annotate what is known, surface what is missing, and draft outputs with a complete provenance trail.",
    ],
  },
  taxonomy: {
    heading: "Built-in annotation labels",
    description:
      "Standardised labels are attached to every workspace so teams can filter evidence, route reviewers, and keep outputs consistent across projects.",
    items: [
      "Evidence Mapped",
      "Requirement Gap",
      "Source Conflict",
      "Unverified Claim",
      "Reviewer Action",
      "Ready for Export",
    ],
  },
  cta: {
    heading: "Ready to start your next investigation?",
    description:
      "Launch a workspace in minutes, define your graph, upload your sources, and generate annotated outputs for review.",
    createWorkspaceCta: "Create Workspace",
    contactSalesCta: "Get in Touch",
    footnote:
      "Open source. Multi-tenant. Role-based permissions, provenance, and auditability built in.",
  },
};
