/**
 * Evidence mapper — runs after a diligence job completes.
 *
 * For each EvidenceRequirement in the project's assistance goal, it finds
 * matching diligence outputs (QuestionAnswers, Findings, Claims) and
 * auto-creates or upgrades EvidenceMapping records.
 *
 * Mapping rules:
 * - A requirement whose node slug maps to a DiligenceCoreQuestion gets a
 *   PARTIAL mapping if the corresponding QuestionAnswer exists and has
 *   sourceCount > 0, or SATISFIED if confidence >= 0.7 and sourceCount >= 2.
 * - Requirements on nodes that don't map to a question (e.g. EVIDENCE_TYPE,
 *   RISK_CATEGORY) are matched by keyword against finding titles and claim text.
 * - Existing SATISFIED or WAIVED mappings are never downgraded.
 */

import { db } from "@/lib/db";
import { GRAPH_NODE_SLUG_TO_QUESTION } from "@/lib/diligence/stages";
import {
  EvidenceRequirementStatus,
  OntologyNodeKind,
  type Prisma,
} from "@/lib/generated/prisma/client";
import { asArray } from "@/lib/utils/coerce";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toJsonValue(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

function chunkRefsFromJson(value: Prisma.JsonValue | null): string[] {
  if (!value) return [];
  return asArray<string>(value).filter((v): v is string => typeof v === "string");
}

function scoreToStatus(
  confidence: number | null,
  sourceCount: number
): EvidenceRequirementStatus {
  if (confidence !== null && confidence >= 0.7 && sourceCount >= 2) {
    return EvidenceRequirementStatus.SATISFIED;
  }
  if (sourceCount > 0 || (confidence !== null && confidence > 0)) {
    return EvidenceRequirementStatus.PARTIAL;
  }
  return EvidenceRequirementStatus.OPEN;
}

function requirementMatchesText(
  requirementTitle: string,
  text: string
): boolean {
  // Simple keyword overlap — split requirement title into significant words
  // and check if any appear in the text (case-insensitive).
  const words = requirementTitle
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4); // skip short stop-words

  if (words.length === 0) return false;
  const lowerText = text.toLowerCase();
  return words.some((word) => lowerText.includes(word));
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export async function autoMapEvidenceForJob(input: {
  jobId: string;
  projectId: string;
  userId: string;
  firmId: string;
}): Promise<{ mapped: number; skipped: number }> {
  const { jobId, projectId, userId, firmId } = input;

  // 1. Check if the project has an assistance goal
  const goal = await db.assistanceGoal.findUnique({
    where: { projectId },
    include: {
      graph: {
        include: {
          evidenceRequirements: {
            include: { node: true },
          },
        },
      },
    },
  });

  if (!goal) {
    return { mapped: 0, skipped: 0 };
  }

  const requirements = goal.graph.evidenceRequirements;
  if (requirements.length === 0) {
    return { mapped: 0, skipped: 0 };
  }

  // 2. Load existing mappings so we don't downgrade SATISFIED/WAIVED
  const existingMappings = await db.evidenceMapping.findMany({
    where: { projectId },
    select: { requirementId: true, status: true },
  });
  const existingStatusMap = new Map(
    existingMappings.map((m) => [m.requirementId, m.status])
  );

  // 3. Load diligence outputs for this job
  const [questionAnswers, findings, claims] = await Promise.all([
    db.diligenceQuestionAnswer.findMany({
      where: { jobId },
      select: {
        question: true,
        summary: true,
        confidence: true,
        sourceCount: true,
        chunkRefs: true,
      },
    }),
    db.diligenceFinding.findMany({
      where: { jobId },
      select: {
        id: true,
        title: true,
        summary: true,
        type: true,
        confidence: true,
        sourceCount: true,
        chunkRefs: true,
      },
    }),
    db.diligenceClaim.findMany({
      where: { jobId },
      select: {
        id: true,
        claimText: true,
        status: true,
        confidence: true,
        sourceCount: true,
        chunkRefs: true,
      },
    }),
  ]);

  // Index question answers by question enum
  const qaByQuestion = new Map(questionAnswers.map((qa) => [qa.question, qa]));

  let mapped = 0;
  let skipped = 0;

  for (const req of requirements) {
    const existingStatus = existingStatusMap.get(req.id);

    // Never downgrade a manually-set SATISFIED or WAIVED
    if (
      existingStatus === EvidenceRequirementStatus.SATISFIED ||
      existingStatus === EvidenceRequirementStatus.WAIVED
    ) {
      skipped++;
      continue;
    }

    const nodeSlug = req.node.slug;
    const nodeKind = req.node.kind;

    let newStatus: EvidenceRequirementStatus = EvidenceRequirementStatus.OPEN;
    let chunkRefs: string[] = [];
    let claimRefs: string[] = [];
    let findingRefs: string[] = [];
    let analystNote: string | null = null;

    // ── Strategy A: node maps to a DiligenceCoreQuestion ─────────────────
    const question = GRAPH_NODE_SLUG_TO_QUESTION[nodeSlug];
    if (question) {
      const qa = qaByQuestion.get(question);
      if (qa) {
        newStatus = scoreToStatus(qa.confidence, qa.sourceCount);
        chunkRefs = chunkRefsFromJson(qa.chunkRefs);

        // Attach relevant findings and claims for this question's node
        const relevantFindings = findings.filter((f) =>
          requirementMatchesText(req.title, f.title + " " + f.summary)
        );
        const relevantClaims = claims.filter((c) =>
          requirementMatchesText(req.title, c.claimText)
        );

        findingRefs = relevantFindings.map((f) => f.id);
        claimRefs = relevantClaims.map((c) => c.id);

        if (qa.summary) {
          analystNote = `Auto-mapped from ${question} answer (confidence: ${qa.confidence?.toFixed(2) ?? "n/a"}, sources: ${qa.sourceCount}).`;
        }
      }
      // If no QA exists for this question yet, leave status as OPEN.
      // Don't fall through to other strategies — this node is question-owned.
    }

    // ── Strategy B: RISK_CATEGORY node — match against findings ──────────
    else if (nodeKind === OntologyNodeKind.RISK_CATEGORY) {
      const matchingFindings = findings.filter((f) =>
        requirementMatchesText(req.title, f.title + " " + f.summary)
      );
      if (matchingFindings.length > 0) {
        findingRefs = matchingFindings.map((f) => f.id);
        chunkRefs = matchingFindings.flatMap((f) => chunkRefsFromJson(f.chunkRefs));
        const avgConfidence =
          matchingFindings.reduce((sum, f) => sum + (f.confidence ?? 0), 0) /
          matchingFindings.length;
        newStatus = scoreToStatus(avgConfidence, matchingFindings.length);
        analystNote = `Auto-mapped from ${matchingFindings.length} finding(s).`;
      }
    }

    // ── Strategy C: CONTROL or QUESTION node — match against claims ───────
    else if (
      nodeKind === OntologyNodeKind.CONTROL ||
      nodeKind === OntologyNodeKind.QUESTION
    ) {
      const matchingClaims = claims.filter((c) =>
        requirementMatchesText(req.title, c.claimText)
      );
      if (matchingClaims.length > 0) {
        claimRefs = matchingClaims.map((c) => c.id);
        chunkRefs = matchingClaims.flatMap((c) => chunkRefsFromJson(c.chunkRefs));
        const supportedCount = matchingClaims.filter(
          (c) => c.status === "SUPPORTED"
        ).length;
        newStatus = scoreToStatus(
          supportedCount / matchingClaims.length,
          matchingClaims.length
        );
        analystNote = `Auto-mapped from ${matchingClaims.length} claim(s).`;
      }
    }

    // ── Strategy D: EVIDENCE_TYPE node — check document classifications ───
    else if (nodeKind === OntologyNodeKind.EVIDENCE_TYPE) {
      const classifications = await db.diligenceDocumentClassification.findMany({
        where: { jobId },
        select: { documentFilename: true, type: true, authoritativeness: true },
      });
      const matchingDocs = classifications.filter((doc) =>
        requirementMatchesText(req.title, doc.documentFilename + " " + doc.type)
      );
      if (matchingDocs.length > 0) {
        const hasPrimary = matchingDocs.some(
          (d) => d.authoritativeness === "primary"
        );
        newStatus = hasPrimary
          ? EvidenceRequirementStatus.SATISFIED
          : EvidenceRequirementStatus.PARTIAL;
        analystNote = `Auto-mapped from ${matchingDocs.length} document classification(s).`;
      }
    }

    // Skip if still OPEN and there was already an OPEN mapping (no change)
    if (
      newStatus === EvidenceRequirementStatus.OPEN &&
      (existingStatus === EvidenceRequirementStatus.OPEN || existingStatus === undefined)
    ) {
      skipped++;
      continue;
    }

    // Skip if status wouldn't change
    if (newStatus === existingStatus) {
      skipped++;
      continue;
    }

    // Upsert the mapping
    await db.evidenceMapping.upsert({
      where: {
        projectId_requirementId: {
          projectId,
          requirementId: req.id,
        },
      },
      create: {
        projectId,
        requirementId: req.id,
        userId,
        firmId,
        status: newStatus,
        analystNote,
        chunkRefs: toJsonValue(chunkRefs),
        claimRefs: toJsonValue(claimRefs),
        findingRefs: toJsonValue(findingRefs),
      },
      update: {
        status: newStatus,
        analystNote,
        ...(chunkRefs.length > 0 && { chunkRefs: toJsonValue(chunkRefs) }),
        ...(claimRefs.length > 0 && { claimRefs: toJsonValue(claimRefs) }),
        ...(findingRefs.length > 0 && { findingRefs: toJsonValue(findingRefs) }),
      },
    });

    mapped++;
  }

  return { mapped, skipped };
}
