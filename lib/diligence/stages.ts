import {
  DiligenceCoreQuestion,
  DiligenceStageName,
} from "@/lib/generated/prisma/client";

const LEGACY_STAGE_ALIASES: Record<string, DiligenceStageName> = {
  RISK_EXTRACTION: DiligenceStageName.Q6_RISK_ANALYSIS,
  CROSS_DOCUMENT_VALIDATION: DiligenceStageName.CORROBORATION,
  CONTRADICTION_DETECTION: DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY,
  EVIDENCE_GRAPH_GENERATION: DiligenceStageName.CORROBORATION,
  EXECUTIVE_SUMMARY_GENERATION: DiligenceStageName.EXECUTIVE_SUMMARY,
  FINAL_REPORT_GENERATION: DiligenceStageName.FINAL_REPORT,
};

export const DILIGENCE_STAGE_SEQUENCE: DiligenceStageName[] = [
  DiligenceStageName.DOCUMENT_EXTRACTION,
  DiligenceStageName.DOCUMENT_CLASSIFICATION,
  DiligenceStageName.EVIDENCE_INDEXING,
  DiligenceStageName.ENTITY_EXTRACTION,
  DiligenceStageName.CLAIM_EXTRACTION,
  DiligenceStageName.CORROBORATION,
  DiligenceStageName.Q1_IDENTITY_AND_OWNERSHIP,
  DiligenceStageName.Q2_PRODUCT_AND_TECHNOLOGY,
  DiligenceStageName.Q3_MARKET_AND_TRACTION,
  DiligenceStageName.Q4_EXECUTION_CAPABILITY,
  DiligenceStageName.Q5_BUSINESS_MODEL_VIABILITY,
  DiligenceStageName.Q6_RISK_ANALYSIS,
  DiligenceStageName.Q7_EVIDENCE_QUALITY,
  DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY,
  DiligenceStageName.OPEN_QUESTIONS,
  DiligenceStageName.EXECUTIVE_SUMMARY,
  DiligenceStageName.FINAL_REPORT,
];

export const STAGE_TO_QUESTION: Partial<
  Record<DiligenceStageName, DiligenceCoreQuestion>
> = {
  [DiligenceStageName.Q1_IDENTITY_AND_OWNERSHIP]: DiligenceCoreQuestion.Q1_IDENTITY,
  [DiligenceStageName.Q2_PRODUCT_AND_TECHNOLOGY]: DiligenceCoreQuestion.Q2_PRODUCT,
  [DiligenceStageName.Q3_MARKET_AND_TRACTION]: DiligenceCoreQuestion.Q3_MARKET,
  [DiligenceStageName.Q4_EXECUTION_CAPABILITY]: DiligenceCoreQuestion.Q4_EXECUTION,
  [DiligenceStageName.Q5_BUSINESS_MODEL_VIABILITY]: DiligenceCoreQuestion.Q5_BUSINESS_MODEL,
  [DiligenceStageName.Q6_RISK_ANALYSIS]: DiligenceCoreQuestion.Q6_RISKS,
  [DiligenceStageName.Q7_EVIDENCE_QUALITY]: DiligenceCoreQuestion.Q7_EVIDENCE,
  [DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY]: DiligenceCoreQuestion.Q8_FAILURE_MODES,
};

export const STAGE_TO_GRAPH_NODE_SLUG: Partial<Record<DiligenceStageName, string>> = {
  [DiligenceStageName.Q1_IDENTITY_AND_OWNERSHIP]: "identity-ownership",
  [DiligenceStageName.Q2_PRODUCT_AND_TECHNOLOGY]: "product-technology",
  [DiligenceStageName.Q3_MARKET_AND_TRACTION]: "market-traction",
  [DiligenceStageName.Q4_EXECUTION_CAPABILITY]: "execution-capability",
  [DiligenceStageName.Q5_BUSINESS_MODEL_VIABILITY]: "business-model-viability",
  [DiligenceStageName.Q6_RISK_ANALYSIS]: "risk-analysis",
  [DiligenceStageName.Q7_EVIDENCE_QUALITY]: "evidence-quality",
  [DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY]: "failure-modes",
};

export const GRAPH_NODE_SLUG_TO_QUESTION: Record<string, DiligenceCoreQuestion> =
  Object.fromEntries(
    Object.entries(STAGE_TO_GRAPH_NODE_SLUG).flatMap(([stage, nodeSlug]) => {
      const question = STAGE_TO_QUESTION[stage as DiligenceStageName];
      return question && nodeSlug ? [[nodeSlug, question]] : [];
    })
  ) as Record<string, DiligenceCoreQuestion>;

export function normalizeStageName(
  stage: DiligenceStageName | string | null | undefined
): DiligenceStageName | null {
  if (!stage) {
    return null;
  }

  const value = String(stage);
  if (
    (Object.values(DiligenceStageName) as string[]).includes(value)
  ) {
    return value as DiligenceStageName;
  }

  return LEGACY_STAGE_ALIASES[value] ?? null;
}

export function getStageProgressPercent(stage: DiligenceStageName | string): number {
  const normalizedStage = normalizeStageName(stage);
  if (!normalizedStage) {
    return 0;
  }

  const index = DILIGENCE_STAGE_SEQUENCE.indexOf(normalizedStage);
  if (index < 0) {
    return 0;
  }
  return Math.round(((index + 1) / DILIGENCE_STAGE_SEQUENCE.length) * 100);
}

export function getNextStage(
  currentStage: DiligenceStageName | string | null
): DiligenceStageName | null {
  if (!currentStage) {
    return DILIGENCE_STAGE_SEQUENCE[0] ?? null;
  }

  const normalizedCurrentStage = normalizeStageName(currentStage);
  if (!normalizedCurrentStage) {
    return DILIGENCE_STAGE_SEQUENCE[0] ?? null;
  }

  const currentIndex = DILIGENCE_STAGE_SEQUENCE.indexOf(normalizedCurrentStage);
  if (currentIndex < 0) {
    return DILIGENCE_STAGE_SEQUENCE[0] ?? null;
  }

  return DILIGENCE_STAGE_SEQUENCE[currentIndex + 1] ?? null;
}
