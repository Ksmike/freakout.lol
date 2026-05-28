import { z } from "zod";
import { db } from "@/lib/db";
import { type ChunkSourceMap } from "@/lib/diligence/corroboration";
import { DiligenceLLMService } from "@/lib/diligence/diligence-llm-service";
import { loadGraphQuestionPromptContext } from "@/lib/diligence/graph-question-context";
import { getStagePromptPlan } from "@/lib/diligence/prompts";
import { STAGE_TO_QUESTION } from "@/lib/diligence/stages";
import {
  asArray,
  asNullableString,
  asNumber,
  asString,
  buildClaimRow,
  buildClassificationRow,
  buildContradictionRow,
  buildFindingRow,
  buildOpenQuestionRow,
  collectChunkRefsFromStructured,
  estimateCostUsd,
  loadChunkSourceMap,
  loadLlmCredentials,
  mergeEntities,
  normalizeSeverity,
  toInputJson,
  toNonNegativeNumber,
  type StageContext,
  type StageExecutionResult,
} from "@/lib/diligence/stage-helpers";
import {
  DiligenceArtifactType,
  DiligenceCoreQuestion,
  DiligenceStageName,
  DiligenceStorageProvider,
  type Prisma,
} from "@/lib/generated/prisma/client";

const MAX_CHUNK_PROMPT_CHARS = 60_000; // ~15k tokens — conservative budget for question stages

// Permissive base schema: every LLM stage envelope is an object that may carry
// summary/items/evidence_gaps. Stage-specific keys (risks, contradictions,
// identity, …) ride along via the looseObject passthrough so the existing
// `structured.<key>` access pattern keeps working.
const STAGE_OUTPUT_SCHEMA = z.looseObject({
  summary: z.string().optional(),
  items: z.array(z.unknown()).optional(),
  evidence_gaps: z.array(z.unknown()).optional(),
});

export async function runLlmStage(
  ctx: StageContext,
  llmService: DiligenceLLMService
): Promise<StageExecutionResult> {
  const credentials = await loadLlmCredentials(ctx);
  const plan = getStagePromptPlan(ctx.stage);

  const userPrompt = await buildStageUserPrompt(ctx, plan.needsFullChunks);

  const llmResult = await llmService.invokeStructured<Record<string, unknown>>({
    stage: ctx.stage,
    systemInstruction: plan.systemInstruction,
    userPrompt,
    outputSchema: plan.outputSchema,
    zodSchema: STAGE_OUTPUT_SCHEMA,
    primary: credentials.primary,
    fallbacks: credentials.fallbacks,
  });

  const items = asArray<Record<string, unknown>>(llmResult.parsed.items);
  const summary = asString(llmResult.parsed.summary, "");
  const evidenceGaps = asArray<Record<string, unknown>>(
    llmResult.parsed.evidence_gaps
  );

  await persistStageOutputs({
    ctx,
    summary,
    items,
    structured: llmResult.parsed,
    evidenceGaps,
  });

  const usage = llmResult.usage ?? {};
  const usageTotal =
    toNonNegativeNumber(usage.total_tokens) ||
    toNonNegativeNumber(usage.input_tokens) +
      toNonNegativeNumber(usage.output_tokens);
  const estimatedCostUsdValue = estimateCostUsd(llmResult.provider, usage);

  return {
    outputJson: {
      summary,
      items,
      structured: llmResult.parsed,
      raw: llmResult.rawText,
    },
    provider: llmResult.provider,
    model: llmResult.model,
    tokenUsageTotal: usageTotal,
    estimatedCostUsd: estimatedCostUsdValue,
  };
}

async function buildStageUserPrompt(
  ctx: StageContext,
  includeFullChunks: boolean
): Promise<string> {
  const plan = getStagePromptPlan(ctx.stage);

  const sections: string[] = [plan.userInstruction];
  const graphQuestionContext = await loadGraphQuestionPromptContext({
    projectId: ctx.projectId,
    stage: ctx.stage,
  });
  if (graphQuestionContext) {
    sections.push("", graphQuestionContext);
  }

  if (includeFullChunks) {
    const chunks = await loadChunksForPrompt(ctx);
    sections.push("", "### Source chunks", chunks);
  }

  const substrate = await loadSubstrateContext(ctx);
  if (substrate) {
    sections.push("", "### Prior diligence substrate", substrate);
  }

  return sections.join("\n");
}

async function loadChunksForPrompt(ctx: StageContext): Promise<string> {
  const chunks = await db.diligenceChunk.findMany({
    where: { jobId: ctx.jobId },
    orderBy: [{ documentPathname: "asc" }, { chunkIndex: "asc" }],
    select: {
      id: true,
      documentFilename: true,
      page: true,
      text: true,
    },
  });

  if (chunks.length === 0) {
    return "(no chunks available — document extraction may have produced no text)";
  }

  const lines: string[] = [];
  let cursor = 0;
  for (const chunk of chunks) {
    const header = `--- chunk_id=${chunk.id} doc="${chunk.documentFilename}" page=${chunk.page ?? "n/a"} ---`;
    const body = chunk.text;
    const blockSize = header.length + body.length + 2;
    if (cursor + blockSize > MAX_CHUNK_PROMPT_CHARS) {
      lines.push(
        `\n[truncated ${chunks.length - lines.length / 2} additional chunks to stay within prompt budget]`
      );
      break;
    }
    lines.push(header, body);
    cursor += blockSize;
  }
  return lines.join("\n");
}

async function loadSubstrateContext(ctx: StageContext): Promise<string | null> {
  const stagesNeedingSubstrate: DiligenceStageName[] = [
    DiligenceStageName.Q1_IDENTITY_AND_OWNERSHIP,
    DiligenceStageName.Q2_PRODUCT_AND_TECHNOLOGY,
    DiligenceStageName.Q3_MARKET_AND_TRACTION,
    DiligenceStageName.Q4_EXECUTION_CAPABILITY,
    DiligenceStageName.Q5_BUSINESS_MODEL_VIABILITY,
    DiligenceStageName.Q6_RISK_ANALYSIS,
    DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY,
    DiligenceStageName.OPEN_QUESTIONS,
    DiligenceStageName.EXECUTIVE_SUMMARY,
    DiligenceStageName.FINAL_REPORT,
  ];

  if (!stagesNeedingSubstrate.includes(ctx.stage)) {
    return null;
  }

  const [classifications, entities, claims, gaps, prevAnswers] = await Promise.all([
    db.diligenceDocumentClassification.findMany({
      where: { jobId: ctx.jobId },
      orderBy: { documentFilename: "asc" },
      select: {
        documentFilename: true,
        type: true,
        vintage: true,
        authoritativeness: true,
        relevance: true,
      },
    }),
    db.diligenceEntity.findMany({
      where: { jobId: ctx.jobId },
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        kind: true,
        confidence: true,
        sourceCount: true,
        metadata: true,
      },
      take: 200,
    }),
    db.diligenceClaim.findMany({
      where: { jobId: ctx.jobId },
      orderBy: { createdAt: "asc" },
      select: {
        claimText: true,
        status: true,
        confidence: true,
        sourceCount: true,
        evidenceRefs: true,
      },
      take: 200,
    }),
    db.diligenceEvidenceGap.findMany({
      where: { jobId: ctx.jobId },
      select: { question: true, title: true, severity: true },
    }),
    db.diligenceQuestionAnswer.findMany({
      where: { jobId: ctx.jobId },
      select: { question: true, summary: true, confidence: true },
    }),
  ]);

  const blocks: string[] = [];

  if (classifications.length > 0) {
    blocks.push(
      "Document classifications (weight evidence by authoritativeness — primary > secondary > derivative):",
      ...classifications.map(
        (doc) =>
          `- ${doc.documentFilename} — type=${doc.type}, authoritativeness=${doc.authoritativeness}, relevance=${doc.relevance}` +
          (doc.vintage ? `, vintage=${doc.vintage}` : "")
      ),
      ""
    );
  }

  if (entities.length > 0) {
    blocks.push(
      "Entities (curated, deduplicated):",
      ...entities.slice(0, 50).map(
        (entity) =>
          `- [${entity.kind}] ${entity.name}` +
          (entity.confidence != null ? ` (conf=${entity.confidence.toFixed(2)})` : "")
      )
    );
  }

  if (claims.length > 0) {
    blocks.push(
      "",
      "Claims (with corroboration status):",
      ...claims.slice(0, 80).map(
        (claim) =>
          `- [${claim.status}, sources=${claim.sourceCount}, conf=${claim.confidence?.toFixed(2) ?? "n/a"}] ${claim.claimText}`
      )
    );
  }

  if (gaps.length > 0) {
    blocks.push(
      "",
      "Already-identified evidence gaps:",
      ...gaps.map((gap) => `- [${gap.question}, ${gap.severity}] ${gap.title}`)
    );
  }

  if (prevAnswers.length > 0) {
    blocks.push(
      "",
      "Already-answered questions (summaries only):",
      ...prevAnswers.map(
        (answer) =>
          `- ${answer.question} (conf=${answer.confidence?.toFixed(2) ?? "n/a"}): ${answer.summary.slice(0, 240)}`
      )
    );
  }

  return blocks.length > 0 ? blocks.join("\n") : null;
}

async function persistStageOutputs(input: {
  ctx: StageContext;
  summary: string;
  items: Record<string, unknown>[];
  structured: Record<string, unknown>;
  evidenceGaps: Record<string, unknown>[];
}): Promise<void> {
  const { ctx, summary, items, structured, evidenceGaps } = input;
  const chunkMap = await loadChunkSourceMap(ctx.jobId);

  if (ctx.stage === DiligenceStageName.DOCUMENT_CLASSIFICATION) {
    await db.diligenceDocumentClassification.deleteMany({
      where: { jobId: ctx.jobId },
    });
    const rows = items
      .map((item) => buildClassificationRow(item, ctx))
      .filter(
        (row): row is Prisma.DiligenceDocumentClassificationCreateManyInput =>
          row !== null
      );
    if (rows.length > 0) {
      await db.diligenceDocumentClassification.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  } else if (ctx.stage === DiligenceStageName.ENTITY_EXTRACTION) {
    await db.diligenceEntity.deleteMany({ where: { jobId: ctx.jobId } });
    const dedupedEntities = mergeEntities(items, chunkMap);
    if (dedupedEntities.length > 0) {
      await db.diligenceEntity.createMany({
        data: dedupedEntities.map((entity) => ({
          projectId: ctx.projectId,
          jobId: ctx.jobId,
          userId: ctx.userId,
          name: entity.name,
          kind: entity.kind,
          confidence: entity.confidence,
          sourceCount: entity.sourceCount,
          chunkRefs: toInputJson(entity.chunkRefs),
          metadata: toInputJson(entity.metadata),
        })),
      });
    }
  } else if (ctx.stage === DiligenceStageName.CLAIM_EXTRACTION) {
    await db.diligenceClaim.deleteMany({ where: { jobId: ctx.jobId } });
    const claimRows = items.map((item) => buildClaimRow(item, chunkMap));
    if (claimRows.length > 0) {
      await db.diligenceClaim.createMany({
        data: claimRows.map((row) => ({
          projectId: ctx.projectId,
          jobId: ctx.jobId,
          userId: ctx.userId,
          claimText: row.claimText,
          status: undefined, // status is computed in CORROBORATION
          confidence: null,
          sourceCount: row.sourceCount,
          chunkRefs: toInputJson(row.chunkRefs),
          evidenceRefs: toInputJson(row.evidence),
        })),
      });
    }
  } else if (ctx.stage === DiligenceStageName.Q6_RISK_ANALYSIS) {
    await db.diligenceFinding.deleteMany({
      where: { jobId: ctx.jobId, type: "RISK" },
    });
    const risks = asArray<Record<string, unknown>>(structured.risks);
    const sourceItems = risks.length > 0 ? risks : items;
    if (sourceItems.length > 0) {
      await db.diligenceFinding.createMany({
        data: sourceItems.map((item) => buildFindingRow(item, chunkMap, ctx)),
      });
    }
    await persistQuestionAnswer(ctx, structured, chunkMap);
  } else if (ctx.stage === DiligenceStageName.Q8_FAILURE_MODES_AND_FRAGILITY) {
    await db.diligenceContradiction.deleteMany({
      where: { jobId: ctx.jobId },
    });
    const contradictions = asArray<Record<string, unknown>>(
      structured.contradictions
    );
    if (contradictions.length > 0) {
      await db.diligenceContradiction.createMany({
        data: contradictions.map((item) =>
          buildContradictionRow(item, chunkMap, ctx)
        ),
      });
    }
    await persistQuestionAnswer(ctx, structured, chunkMap);
  } else if (STAGE_TO_QUESTION[ctx.stage]) {
    await persistQuestionAnswer(ctx, structured, chunkMap);
  } else if (ctx.stage === DiligenceStageName.OPEN_QUESTIONS) {
    await db.diligenceOpenQuestion.deleteMany({ where: { jobId: ctx.jobId } });
    if (items.length > 0) {
      await db.diligenceOpenQuestion.createMany({
        data: items.map((item) => buildOpenQuestionRow(item, ctx)),
      });
    }
  } else if (
    ctx.stage === DiligenceStageName.EXECUTIVE_SUMMARY ||
    ctx.stage === DiligenceStageName.FINAL_REPORT
  ) {
    await db.diligenceArtifact.create({
      data: {
        projectId: ctx.projectId,
        jobId: ctx.jobId,
        userId: ctx.userId,
        stage: ctx.stage,
        type: DiligenceArtifactType.GENERATED_REPORT,
        storageProvider: DiligenceStorageProvider.JSON_COLUMN,
        storageKey: `db:diligence-report:${ctx.jobId}:${ctx.stage}`,
        mimeType: "application/json",
        sizeBytes: null,
        checksum: null,
        metadata: toInputJson({ summary, items, structured }),
      },
    });
  }

  // Evidence gaps are stage-agnostic. Dedup is scoped to the source stage so
  // multiple stages without a question mapping (CLASSIFICATION, INDEXING,
  // ENTITY/CLAIM extraction, CORROBORATION, OPEN_QUESTIONS, summaries) can
  // each contribute Q7_EVIDENCE gaps without overwriting each other.
  await db.diligenceEvidenceGap.deleteMany({
    where: { jobId: ctx.jobId, sourceStage: ctx.stage },
  });
  if (evidenceGaps.length > 0) {
    const question =
      STAGE_TO_QUESTION[ctx.stage] ?? DiligenceCoreQuestion.Q7_EVIDENCE;
    await db.diligenceEvidenceGap.createMany({
      data: evidenceGaps.map((gap) => ({
        projectId: ctx.projectId,
        jobId: ctx.jobId,
        userId: ctx.userId,
        question,
        sourceStage: ctx.stage,
        title: asString(gap.title, "Evidence gap"),
        description: asString(gap.description, ""),
        severity: normalizeSeverity(gap.severity),
        suggestedSource:
          asNullableString(gap.suggested_source ?? gap.suggestedSource) ?? null,
      })),
    });
  }
}

async function persistQuestionAnswer(
  ctx: StageContext,
  structured: Record<string, unknown>,
  chunkMap: ChunkSourceMap
): Promise<void> {
  const question = STAGE_TO_QUESTION[ctx.stage];
  if (!question) {
    return;
  }
  const summary = asString(structured.summary, "");
  const confidence = asNumber(structured.confidence);
  const chunkRefs = collectChunkRefsFromStructured(structured);
  const distinctDocuments = new Set<string>();
  for (const chunkId of chunkRefs) {
    const document = chunkMap.get(chunkId);
    if (document) {
      distinctDocuments.add(document);
    }
  }

  await db.diligenceQuestionAnswer.upsert({
    where: { jobId_question: { jobId: ctx.jobId, question } },
    create: {
      projectId: ctx.projectId,
      jobId: ctx.jobId,
      userId: ctx.userId,
      question,
      summary,
      structured: toInputJson(structured),
      confidence,
      sourceCount: distinctDocuments.size,
      chunkRefs: toInputJson(chunkRefs),
    },
    update: {
      summary,
      structured: toInputJson(structured),
      confidence,
      sourceCount: distinctDocuments.size,
      chunkRefs: toInputJson(chunkRefs),
    },
  });
}
