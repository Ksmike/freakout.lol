/**
 * Draft renderer — assembles a source-backed output draft from:
 * - An OutputTemplate (section schema from the graph definition)
 * - DiligenceQuestionAnswer rows (Q1–Q8 summaries + structured data)
 * - EvidenceMapping rows (requirement status per section)
 * - DiligenceFinding rows (risks, opportunities)
 * - DiligenceClaim rows (key claims)
 * - DiligenceOpenQuestion rows (unresolved questions)
 *
 * Returns a DraftReport that the UI can render section by section.
 */

import { db } from "@/lib/db";
import { DiligenceCoreQuestion } from "@/lib/generated/prisma/client";
import { asArray, asString, asNumber } from "@/lib/utils/coerce";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DraftSection = {
  id: string;
  title: string;
  nodeSlug: string | null;
  // The Q-answer summary for this section (if a question node)
  summary: string | null;
  confidence: number | null;
  sourceCount: number;
  // Structured sub-fields from the LLM output (varies by section)
  structured: Record<string, unknown> | null;
  // Evidence mapping status for requirements under this node
  requirementsSatisfied: number;
  requirementsTotal: number;
  // Key findings relevant to this section
  findings: Array<{ id: string; title: string; summary: string; severity: string | null; confidence: number | null }>;
  // Key claims relevant to this section
  claims: Array<{ id: string; claimText: string; status: string; confidence: number | null }>;
  // Evidence gaps for this section
  gaps: Array<{ title: string; severity: string; description: string }>;
};

export type DraftReport = {
  templateName: string;
  templateKind: string;
  jobId: string;
  completedAt: Date | null;
  sections: DraftSection[];
  openQuestions: Array<{
    category: string;
    question: string;
    rationale: string;
    priority: string;
  }>;
  overallConfidence: number | null;
};

// ─── Node slug → DiligenceCoreQuestion ───────────────────────────────────────

const NODE_SLUG_TO_QUESTION: Record<string, DiligenceCoreQuestion> = {
  "identity-ownership": DiligenceCoreQuestion.Q1_IDENTITY,
  "product-technology": DiligenceCoreQuestion.Q2_PRODUCT,
  "market-traction": DiligenceCoreQuestion.Q3_MARKET,
  "execution-capability": DiligenceCoreQuestion.Q4_EXECUTION,
  "business-model-viability": DiligenceCoreQuestion.Q5_BUSINESS_MODEL,
  "risk-analysis": DiligenceCoreQuestion.Q6_RISKS,
  "evidence-quality": DiligenceCoreQuestion.Q7_EVIDENCE,
  "failure-modes": DiligenceCoreQuestion.Q8_FAILURE_MODES,
};

// ─── Template schema type ─────────────────────────────────────────────────────

type TemplateSectionDef = {
  id: string;
  title: string;
  nodeSlug: string | null;
};

type TemplateSchema = {
  sections: TemplateSectionDef[];
};

// ─── Renderer ─────────────────────────────────────────────────────────────────

export async function renderOutputDraft(input: {
  projectId: string;
  userId: string;
}): Promise<DraftReport | null> {
  const { projectId, userId } = input;

  // 1. Get the assistance goal and its output template
  const goal = await db.assistanceGoal.findUnique({
    where: { projectId },
    include: {
      graph: {
        include: {
          outputTemplates: { orderBy: { kind: "asc" }, take: 1 },
          evidenceRequirements: {
            include: { node: true },
          },
        },
      },
    },
  });

  if (!goal || goal.graph.outputTemplates.length === 0) {
    return null;
  }

  const template = goal.graph.outputTemplates[0];
  const schema = template.schema as TemplateSchema;
  const sections = asArray<TemplateSectionDef>(schema?.sections);

  if (sections.length === 0) {
    return null;
  }

  // 2. Get the latest completed job for this project
  const job = await db.diligenceJob.findFirst({
    where: { projectId, userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      completedAt: true,
      tokenUsageTotal: true,
      estimatedCostUsd: true,
    },
  });

  if (!job) {
    return null;
  }

  // 3. Load all diligence outputs for this job in parallel
  const [questionAnswers, findings, claims, evidenceGaps, openQuestions, mappings] =
    await Promise.all([
      db.diligenceQuestionAnswer.findMany({
        where: { jobId: job.id },
        select: {
          question: true,
          summary: true,
          confidence: true,
          sourceCount: true,
          structured: true,
          chunkRefs: true,
        },
      }),
      db.diligenceFinding.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          summary: true,
          type: true,
          severity: true,
          confidence: true,
          chunkRefs: true,
        },
      }),
      db.diligenceClaim.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          claimText: true,
          status: true,
          confidence: true,
          evidenceRefs: true,
        },
      }),
      db.diligenceEvidenceGap.findMany({
        where: { jobId: job.id },
        select: {
          question: true,
          title: true,
          severity: true,
          description: true,
        },
      }),
      db.diligenceOpenQuestion.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
        select: {
          category: true,
          question: true,
          rationale: true,
          priority: true,
        },
      }),
      db.evidenceMapping.findMany({
        where: { projectId },
        include: {
          requirement: {
            include: { node: true },
          },
        },
      }),
    ]);

  // Index by question
  const qaByQuestion = new Map(questionAnswers.map((qa) => [qa.question, qa]));

  // Index evidence gaps by question
  const gapsByQuestion = new Map<string, typeof evidenceGaps>();
  for (const gap of evidenceGaps) {
    const key = gap.question;
    if (!gapsByQuestion.has(key)) gapsByQuestion.set(key, []);
    gapsByQuestion.get(key)!.push(gap);
  }

  // Index mappings by node slug
  const mappingsByNodeSlug = new Map<string, { satisfied: number; total: number }>();
  for (const m of mappings) {
    const slug = m.requirement.node.slug;
    const existing = mappingsByNodeSlug.get(slug) ?? { satisfied: 0, total: 0 };
    existing.total++;
    if (m.status === "SATISFIED") existing.satisfied++;
    mappingsByNodeSlug.set(slug, existing);
  }

  // 4. Build each section
  const builtSections: DraftSection[] = [];

  for (const sectionDef of sections) {
    const nodeSlug = sectionDef.nodeSlug ?? null;
    const question = nodeSlug ? NODE_SLUG_TO_QUESTION[nodeSlug] : undefined;
    const qa = question ? qaByQuestion.get(question) : undefined;
    const reqCounts = nodeSlug ? mappingsByNodeSlug.get(nodeSlug) : undefined;

    // Findings relevant to this section
    const sectionFindings = findings.filter((f) => {
      if (!nodeSlug) return false;
      // Risk findings go to risk-analysis and failure-modes sections
      if (f.type === "RISK" && (nodeSlug === "risk-analysis" || nodeSlug === "failure-modes")) {
        return true;
      }
      return false;
    });

    // Claims relevant to this section — use keyword matching on the section title
    const sectionClaims = claims.filter((c) => {
      if (!nodeSlug) return false;
      const titleWords = sectionDef.title
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4);
      return titleWords.some((w) => c.claimText.toLowerCase().includes(w));
    });

    // Evidence gaps for this section
    const sectionGaps = question
      ? (gapsByQuestion.get(question) ?? []).map((g) => ({
          title: g.title,
          severity: g.severity,
          description: g.description,
        }))
      : [];

    // Parse structured output
    let structured: Record<string, unknown> | null = null;
    if (qa?.structured && typeof qa.structured === "object" && !Array.isArray(qa.structured)) {
      structured = qa.structured as Record<string, unknown>;
    }

    builtSections.push({
      id: sectionDef.id,
      title: sectionDef.title,
      nodeSlug,
      summary: qa?.summary ?? null,
      confidence: qa?.confidence ?? null,
      sourceCount: qa?.sourceCount ?? 0,
      structured,
      requirementsSatisfied: reqCounts?.satisfied ?? 0,
      requirementsTotal: reqCounts?.total ?? 0,
      findings: sectionFindings.slice(0, 5).map((f) => ({
        id: f.id,
        title: f.title,
        summary: f.summary,
        severity: f.severity,
        confidence: f.confidence,
      })),
      claims: sectionClaims.slice(0, 5).map((c) => ({
        id: c.id,
        claimText: c.claimText,
        status: c.status,
        confidence: c.confidence,
      })),
      gaps: sectionGaps.slice(0, 5),
    });
  }

  // 5. Compute overall confidence as average of Q-section confidences
  const confidenceValues = builtSections
    .map((s) => s.confidence)
    .filter((c): c is number => c !== null);
  const overallConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : null;

  return {
    templateName: asString(template.name),
    templateKind: asString(template.kind),
    jobId: job.id,
    completedAt: job.completedAt,
    sections: builtSections,
    openQuestions: openQuestions.map((q) => ({
      category: q.category,
      question: q.question,
      rationale: q.rationale,
      priority: q.priority,
    })),
    overallConfidence,
  };
}
