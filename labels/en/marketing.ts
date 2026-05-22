import type { MarketingLabels } from "@/labels/types";

export const marketingLabels: MarketingLabels = {
  hero: {
    badge: "Technology for Compliance",
    title: "Evidence-backed knowledge graphs for compliance workflows.",
    description:
      "SOC 2, ISO 27001, GDPR, and diligence workflows made easier with document mapping, gap detection, and source-backed outputs.",
    trialCta: "Start Free Trial",
    demoCta: "See It in Action",
    segmentLabels: [
      "SOC 2",
      "ISO 27001",
      "GDPR",
      "Vendor Review",
      "CDD",
      "PE Diligence",
    ],
  },
  metrics: [
    { label: "Evidence sources mapped per workflow", value: "12+" },
    { label: "Controls and claims structured automatically", value: "1,000+" },
    { label: "Outputs traceable to source evidence", value: "100%" },
  ],
  workflow: {
    heading: "How KG Qualify works",
    steps: [
      {
        title: "Choose",
        description:
          "Select a regulated workflow such as SOC 2, ISO 27001, GDPR, vendor review, or commercial diligence from an admin-approved knowledge graph.",
      },
      {
        title: "Map",
        description:
          "Upload policies, contracts, reports, call notes, and data room files. Evidence is structured into the graph against required controls, claims, entities, and form fields.",
      },
      {
        title: "Complete",
        description:
          "Gaps are surfaced, follow-up questions are generated, and forms, reports, and review packs are drafted with provenance back to every source document.",
      },
    ],
  },
  coverage: {
    heading: "Knowledge workflows your firm can trust",
    description:
      "Built for regulated workflows where teams need to prove what they know, where it came from, and what is still missing.",
    items: [
      "Industry-specific knowledge graphs nominated by admins",
      "Evidence requirements mapped to source documents",
      "Gap detection across controls, forms, and diligence questions",
      "Human review before conclusions or submissions",
      "Firm-scoped workspaces for multiple teams and engagements",
      "Every output linked back to source evidence",
    ],
    outcomesTitle: "Workflow outcomes",
    outcomesParagraphs: [
      "Regulated teams spend too much time manually translating scattered documents into questionnaires, control evidence, diligence packs, and review notes. The hard part is not just extraction; it is knowing which evidence satisfies which requirement and what still needs to be gathered.",
      "KG Qualify turns each workflow into a closed loop: nominate the graph, upload evidence, map what is known, ask for what is missing, and draft the output with a complete provenance trail.",
    ],
  },
  taxonomy: {
    heading: "Built-in workflow labels",
    description:
      "Standardised labels are attached to every workspace so teams can filter evidence, route reviewers, and keep regulated outputs consistent across engagements.",
    items: [
      "Control Evidence",
      "Requirement Gap",
      "Source Conflict",
      "Unverified Claim",
      "Reviewer Action",
      "Ready for Export",
    ],
  },
  cta: {
    heading: "Ready to simplify your next compliance workflow?",
    description:
      "Launch a workspace in minutes, choose an assistance goal, upload your sources, and generate evidence-backed outputs for review.",
    createWorkspaceCta: "Create Workspace",
    contactSalesCta: "Get in Touch",
    footnote:
      "Multi-tenant firms, role-based permissions, provenance, and auditability built into the roadmap.",
  },
};
