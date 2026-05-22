/**
 * Seed data for the "Commercial Due Diligence" knowledge graph.
 *
 * This is the first published graph definition. It maps the 8 core diligence
 * questions to ontology nodes, evidence requirements, and an output template.
 *
 * Run via: yarn tsx lib/graph/seeds/seed.ts
 */

import { db } from "@/lib/db";
import { GraphDefinitionStatus, OntologyNodeKind } from "@/lib/generated/prisma/client";

const SLUG = "commercial-due-diligence";

type NodeDef = {
  slug: string;
  label: string;
  description: string;
  kind: OntologyNodeKind;
  requirements: { title: string; description: string; priority: "high" | "medium" | "low" }[];
};

const NODES: NodeDef[] = [
  {
    slug: "identity-ownership",
    label: "Identity & Ownership",
    description: "Corporate structure, cap table, founders, and legal standing.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Corporate registration and legal name", description: "Certificate of incorporation or equivalent.", priority: "high" },
      { title: "Cap table and ownership structure", description: "Current cap table showing all shareholders and percentages.", priority: "high" },
      { title: "Founder backgrounds and track record", description: "Bios, LinkedIn profiles, or reference checks for key founders.", priority: "high" },
      { title: "IP ownership and assignment agreements", description: "Confirm IP is assigned to the company, not held personally.", priority: "high" },
      { title: "Regulatory licences and permits", description: "Any sector-specific licences required to operate.", priority: "medium" },
    ],
  },
  {
    slug: "product-technology",
    label: "Product & Technology",
    description: "Product maturity, technical architecture, and defensibility.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Product demo or live walkthrough", description: "Working demo or recorded walkthrough of the core product.", priority: "high" },
      { title: "Technical architecture overview", description: "High-level architecture diagram and stack description.", priority: "high" },
      { title: "Build vs buy decisions and dependencies", description: "Key third-party dependencies and rationale.", priority: "medium" },
      { title: "Security posture and data handling", description: "SOC 2, pen test results, or equivalent security evidence.", priority: "medium" },
      { title: "Product roadmap (12 months)", description: "Prioritised roadmap with milestones and owners.", priority: "medium" },
    ],
  },
  {
    slug: "market-traction",
    label: "Market & Traction",
    description: "Market size, competitive positioning, and evidence of traction.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "TAM/SAM/SOM analysis", description: "Market sizing with methodology and sources.", priority: "high" },
      { title: "Customer list and reference contacts", description: "Named customers with permission to contact for references.", priority: "high" },
      { title: "Revenue and ARR/MRR history", description: "Monthly revenue data for the last 24 months.", priority: "high" },
      { title: "Churn and retention metrics", description: "Logo and revenue churn rates, NRR.", priority: "high" },
      { title: "Competitive landscape analysis", description: "Named competitors with differentiation rationale.", priority: "medium" },
      { title: "Pipeline and sales velocity", description: "Current pipeline value and average sales cycle.", priority: "medium" },
    ],
  },
  {
    slug: "execution-capability",
    label: "Execution Capability",
    description: "Team depth, hiring plan, and operational maturity.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Org chart and key hires", description: "Current org chart with open roles highlighted.", priority: "high" },
      { title: "Key person dependencies", description: "Identify single points of failure in the team.", priority: "high" },
      { title: "Hiring plan and budget", description: "12-month hiring plan with cost assumptions.", priority: "medium" },
      { title: "Board and advisor composition", description: "Board members, advisors, and their relevant experience.", priority: "medium" },
    ],
  },
  {
    slug: "business-model-viability",
    label: "Business Model Viability",
    description: "Unit economics, pricing, and path to profitability.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Unit economics (CAC, LTV, payback)", description: "CAC, LTV, and payback period with methodology.", priority: "high" },
      { title: "Pricing model and packaging", description: "Current pricing tiers and rationale.", priority: "high" },
      { title: "Gross margin by segment", description: "Gross margin breakdown by product line or customer segment.", priority: "high" },
      { title: "Financial model (3-year)", description: "Three-year P&L, cash flow, and balance sheet projections.", priority: "high" },
      { title: "Burn rate and runway", description: "Current monthly burn and months of runway.", priority: "high" },
    ],
  },
  {
    slug: "risk-analysis",
    label: "Risk Analysis",
    description: "Key risks across legal, regulatory, market, and operational dimensions.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Material contracts and obligations", description: "Key customer, supplier, and partner contracts.", priority: "high" },
      { title: "Litigation and disputes history", description: "Any current or historical litigation.", priority: "high" },
      { title: "Regulatory risk assessment", description: "Known regulatory risks and mitigation plans.", priority: "medium" },
      { title: "Customer concentration risk", description: "Revenue concentration by top 5 customers.", priority: "medium" },
      { title: "Technology and vendor lock-in risks", description: "Dependencies on single vendors or platforms.", priority: "medium" },
    ],
  },
  {
    slug: "evidence-quality",
    label: "Evidence Quality",
    description: "Reliability and completeness of the evidence provided.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Audited or reviewed financials", description: "Audited accounts or accountant-reviewed financials.", priority: "high" },
      { title: "Third-party validation (analyst reports, press)", description: "Independent coverage or validation of claims.", priority: "medium" },
      { title: "Data room completeness", description: "All requested documents provided without gaps.", priority: "medium" },
    ],
  },
  {
    slug: "failure-modes",
    label: "Failure Modes & Fragility",
    description: "Scenarios that could break the business and mitigations.",
    kind: OntologyNodeKind.QUESTION,
    requirements: [
      { title: "Scenario analysis (bear case)", description: "Bear case financial model with key assumptions.", priority: "high" },
      { title: "Key customer loss impact", description: "Impact analysis if top 1-3 customers churn.", priority: "high" },
      { title: "Founder departure plan", description: "Succession or continuity plan for key founders.", priority: "medium" },
      { title: "Technology failure or outage plan", description: "Disaster recovery and business continuity documentation.", priority: "medium" },
    ],
  },
];

const OUTPUT_TEMPLATE = {
  slug: "cdd-report",
  name: "Commercial Due Diligence Report",
  kind: "REPORT" as const,
  schema: {
    sections: [
      { id: "executive-summary", title: "Executive Summary", nodeSlug: null },
      { id: "identity-ownership", title: "Identity & Ownership", nodeSlug: "identity-ownership" },
      { id: "product-technology", title: "Product & Technology", nodeSlug: "product-technology" },
      { id: "market-traction", title: "Market & Traction", nodeSlug: "market-traction" },
      { id: "execution-capability", title: "Execution Capability", nodeSlug: "execution-capability" },
      { id: "business-model", title: "Business Model Viability", nodeSlug: "business-model-viability" },
      { id: "risk-analysis", title: "Risk Analysis", nodeSlug: "risk-analysis" },
      { id: "evidence-quality", title: "Evidence Quality", nodeSlug: "evidence-quality" },
      { id: "failure-modes", title: "Failure Modes & Fragility", nodeSlug: "failure-modes" },
      { id: "open-questions", title: "Open Questions & Evidence Gaps", nodeSlug: null },
      { id: "recommendation", title: "Recommendation", nodeSlug: null },
    ],
  },
};

export async function seedCommercialDueDiligenceGraph(): Promise<void> {
  console.log("Seeding Commercial Due Diligence graph...");

  // Idempotent: skip if already exists and published
  const existing = await db.knowledgeGraphDefinition.findUnique({
    where: { slug: SLUG },
    select: { id: true, status: true },
  });

  if (existing?.status === GraphDefinitionStatus.PUBLISHED) {
    console.log("Graph already published, skipping.");
    return;
  }

  // Create or update the graph definition
  const graph = await db.knowledgeGraphDefinition.upsert({
    where: { slug: SLUG },
    create: {
      slug: SLUG,
      name: "Commercial Due Diligence",
      description:
        "Structured evidence gathering for pre-investment commercial due diligence. Covers identity, product, market, execution, business model, risk, evidence quality, and failure modes.",
      version: 1,
      status: GraphDefinitionStatus.DRAFT,
    },
    update: {
      name: "Commercial Due Diligence",
      description:
        "Structured evidence gathering for pre-investment commercial due diligence. Covers identity, product, market, execution, business model, risk, evidence quality, and failure modes.",
    },
  });

  console.log(`Graph: ${graph.id}`);

  // Upsert nodes and their requirements
  for (const nodeDef of NODES) {
    const node = await db.ontologyNode.upsert({
      where: { graphId_slug: { graphId: graph.id, slug: nodeDef.slug } },
      create: {
        graphId: graph.id,
        slug: nodeDef.slug,
        label: nodeDef.label,
        description: nodeDef.description,
        kind: nodeDef.kind,
      },
      update: {
        label: nodeDef.label,
        description: nodeDef.description,
        kind: nodeDef.kind,
      },
    });

    for (const req of nodeDef.requirements) {
      // Check if requirement already exists by title+nodeId (no unique constraint on title, use findFirst)
      const existing = await db.evidenceRequirement.findFirst({
        where: { nodeId: node.id, title: req.title },
        select: { id: true },
      });

      if (!existing) {
        await db.evidenceRequirement.create({
          data: {
            graphId: graph.id,
            nodeId: node.id,
            title: req.title,
            description: req.description,
            priority: req.priority,
          },
        });
      }
    }

    console.log(`  Node: ${nodeDef.label} (${nodeDef.requirements.length} requirements)`);
  }

  // Upsert output template
  await db.outputTemplate.upsert({
    where: { graphId_slug: { graphId: graph.id, slug: OUTPUT_TEMPLATE.slug } },
    create: {
      graphId: graph.id,
      slug: OUTPUT_TEMPLATE.slug,
      name: OUTPUT_TEMPLATE.name,
      kind: OUTPUT_TEMPLATE.kind,
      schema: OUTPUT_TEMPLATE.schema,
    },
    update: {
      name: OUTPUT_TEMPLATE.name,
      schema: OUTPUT_TEMPLATE.schema,
    },
  });

  // Publish
  await db.knowledgeGraphDefinition.update({
    where: { id: graph.id },
    data: { status: GraphDefinitionStatus.PUBLISHED },
  });

  console.log("Graph published.");
}
