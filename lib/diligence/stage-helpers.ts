import { db } from "@/lib/db";
import { DiligenceFatalError } from "@/lib/diligence/errors";
import { UserApiKeyModel } from "@/lib/models/UserApiKeyModel";
import type { ChunkSourceMap } from "@/lib/diligence/corroboration";
import {
  ApiKeyProvider,
  DiligenceCoreQuestion,
  type DiligenceStageName,
  type Prisma,
} from "@/lib/generated/prisma/client";
import {
  asArray,
  asStringArray,
  asNullableString,
  asString,
  asNumber,
} from "@/lib/utils/coerce";

// ───────────────────────── Types ─────────────────────────

export type StageContext = {
  stage: DiligenceStageName;
  jobId: string;
  projectId: string;
  userId: string;
  firmId: string;
  selectedProvider: ApiKeyProvider;
  selectedModel: string;
  fallbackProviders: ApiKeyProvider[];
  userApiKeyId: string | null;
};

export type StageExecutionResult = {
  outputJson: Record<string, unknown>;
  provider?: ApiKeyProvider;
  model?: string;
  tokenUsageTotal?: number;
  estimatedCostUsd?: number;
};

export type LlmCredentials = {
  primary: { provider: ApiKeyProvider; model: string; apiKey: string };
  fallbacks: Array<{ provider: ApiKeyProvider; model: string; apiKey: string }>;
};

// ───────────────────────── Numeric / JSON helpers ─────────────────────────

export function toNonNegativeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function streamToBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
    }
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function estimateCostUsd(
  provider: ApiKeyProvider,
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
): number {
  const inputTokens = toNonNegativeNumber(usage.input_tokens);
  const outputTokens = toNonNegativeNumber(usage.output_tokens);
  const totalTokens = toNonNegativeNumber(usage.total_tokens);

  if (provider === ApiKeyProvider.OPENAI) {
    return inputTokens * 0.00000015 + outputTokens * 0.0000006;
  }
  if (provider === ApiKeyProvider.ANTHROPIC) {
    return inputTokens * 0.0000003 + outputTokens * 0.0000015;
  }
  if (provider === ApiKeyProvider.GOOGLE) {
    return totalTokens * 0.0000002;
  }
  return 0;
}

// ───────────────────────── Shape coercion ─────────────────────────
// Re-exported from the shared utility module for backward compatibility.
// Consumers that import from stage-helpers continue to work unchanged.

export {
  asArray,
  asStringArray,
  asNullableString,
  asString,
  asNumber,
} from "@/lib/utils/coerce";

// ───────────────────────── Row builders ─────────────────────────

export function mergeEntities(
  items: Record<string, unknown>[],
  chunkMap: ChunkSourceMap
): Array<{
  name: string;
  kind: string;
  confidence: number | null;
  sourceCount: number;
  chunkRefs: string[];
  metadata: Record<string, unknown>;
}> {
  const merged = new Map<
    string,
    {
      name: string;
      kind: string;
      confidence: number | null;
      chunkRefs: Set<string>;
      sourceDocs: Set<string>;
      metadata: Record<string, unknown>;
    }
  >();

  for (const item of items) {
    const name = asString(item.name);
    if (!name.trim()) {
      continue;
    }
    const kind = asString(item.kind ?? item.type, "unknown");
    const key = `${kind.toLowerCase()}::${name.trim().toLowerCase()}`;
    const chunkRefs = asStringArray(item.chunk_refs ?? item.chunkRefs);
    const docs = chunkRefs
      .map((id) => chunkMap.get(id))
      .filter((doc): doc is string => Boolean(doc));

    const existing = merged.get(key);
    if (existing) {
      for (const ref of chunkRefs) existing.chunkRefs.add(ref);
      for (const doc of docs) existing.sourceDocs.add(doc);
      const c = asNumber(item.confidence);
      if (c !== null && (existing.confidence === null || c > existing.confidence)) {
        existing.confidence = c;
      }
    } else {
      merged.set(key, {
        name: name.trim(),
        kind,
        confidence: asNumber(item.confidence),
        chunkRefs: new Set(chunkRefs),
        sourceDocs: new Set(docs),
        metadata: item,
      });
    }
  }

  return Array.from(merged.values()).map((entry) => ({
    name: entry.name,
    kind: entry.kind,
    confidence: entry.confidence,
    sourceCount: entry.sourceDocs.size,
    chunkRefs: Array.from(entry.chunkRefs),
    metadata: entry.metadata,
  }));
}

export function buildClaimRow(
  item: Record<string, unknown>,
  chunkMap: ChunkSourceMap
): {
  claimText: string;
  chunkRefs: string[];
  sourceCount: number;
  evidence: Record<string, unknown>;
} {
  const chunkRefs = asStringArray(item.chunk_refs ?? item.chunkRefs);
  const distinctDocs = new Set<string>();
  for (const ref of chunkRefs) {
    const doc = chunkMap.get(ref);
    if (doc) distinctDocs.add(doc);
  }
  return {
    claimText:
      asString(item.claim) ||
      asString(item.claimText) ||
      asString(item.title) ||
      "Unnamed claim",
    chunkRefs,
    sourceCount: distinctDocs.size,
    evidence: {
      category: item.category ?? null,
      quantitative: Boolean(item.quantitative),
      value: item.value ?? null,
      unit: item.unit ?? null,
      period: item.period ?? null,
      source: item.source ?? null,
      raw: item,
    },
  };
}

export function buildFindingRow(
  item: Record<string, unknown>,
  chunkMap: ChunkSourceMap,
  ctx: StageContext
): Prisma.DiligenceFindingCreateManyInput {
  const chunkRefs = asStringArray(item.chunk_refs ?? item.chunkRefs);
  const distinctDocs = new Set<string>();
  for (const ref of chunkRefs) {
    const doc = chunkMap.get(ref);
    if (doc) distinctDocs.add(doc);
  }
  return {
    projectId: ctx.projectId,
    jobId: ctx.jobId,
    userId: ctx.userId,
    type: "RISK",
    title: asString(item.title, asString(item.category, "Risk")),
    summary:
      asString(item.description) ||
      asString(item.summary) ||
      asString(item.details) ||
      "No description provided.",
    severity: normalizeSeverity(item.severity),
    confidence: asNumber(item.confidence),
    sourceCount: distinctDocs.size,
    chunkRefs: toInputJson(chunkRefs),
    evidenceRefs: toInputJson({
      category: item.category ?? null,
      evidence_strength: item.evidence_strength ?? null,
      mitigation_disclosed: item.mitigation_disclosed ?? null,
    }),
    metadata: toInputJson(item),
  };
}

export function buildContradictionRow(
  item: Record<string, unknown>,
  chunkMap: ChunkSourceMap,
  ctx: StageContext
): Prisma.DiligenceContradictionCreateManyInput {
  const refsA = asStringArray(item.chunk_refs_a ?? item.chunkRefsA);
  const refsB = asStringArray(item.chunk_refs_b ?? item.chunkRefsB);
  const allRefs = [...refsA, ...refsB];
  return {
    projectId: ctx.projectId,
    jobId: ctx.jobId,
    userId: ctx.userId,
    statementA: asString(item.statement_a ?? item.statementA, "Unspecified statement A"),
    statementB: asString(item.statement_b ?? item.statementB, "Unspecified statement B"),
    severity: normalizeSeverity(item.severity),
    confidence: asNumber(item.confidence),
    chunkRefs: toInputJson(allRefs),
    evidenceRefs: toInputJson({
      explanation: item.explanation ?? null,
      sources_a: refsA.map((id) => chunkMap.get(id) ?? id),
      sources_b: refsB.map((id) => chunkMap.get(id) ?? id),
    }),
  };
}

export function buildClassificationRow(
  item: Record<string, unknown>,
  ctx: StageContext
): Prisma.DiligenceDocumentClassificationCreateManyInput | null {
  const documentPathname =
    asNullableString(item.document_pathname ?? item.documentPathname) ??
    asNullableString(item.pathname);
  if (!documentPathname) {
    return null;
  }
  return {
    projectId: ctx.projectId,
    jobId: ctx.jobId,
    userId: ctx.userId,
    documentPathname,
    documentFilename: asString(
      item.filename ?? item.documentFilename,
      documentPathname
    ),
    type: normalizeClassificationType(item.type),
    vintage: asNullableString(item.vintage) ?? null,
    authoritativeness: normalizeAuthoritativeness(item.authoritativeness),
    relevance: normalizeRelevance(item.relevance),
    topicsCovered: toInputJson(
      asStringArray(item.topics_covered ?? item.topicsCovered)
    ),
    confidence: asNumber(item.confidence),
    chunkRefs: toInputJson(asStringArray(item.chunk_refs ?? item.chunkRefs)),
    rationale: asNullableString(item.rationale) ?? null,
  };
}

export function buildOpenQuestionRow(
  item: Record<string, unknown>,
  ctx: StageContext
): Prisma.DiligenceOpenQuestionCreateManyInput {
  const category = normalizeQuestionCategory(item.category);
  return {
    projectId: ctx.projectId,
    jobId: ctx.jobId,
    userId: ctx.userId,
    category,
    question: asString(item.question, "Unspecified question"),
    rationale: asString(item.rationale, ""),
    priority: normalizePriority(item.priority),
    resolvedBy:
      asNullableString(item.resolved_by) ?? asNullableString(item.resolvedBy),
    chunkRefs: toInputJson(asStringArray(item.chunk_refs ?? item.chunkRefs)),
  };
}

// ───────────────────────── Normalizers ─────────────────────────

export function normalizeClassificationType(value: unknown): string {
  const normalized = asString(value, "").toLowerCase();
  const accepted = new Set([
    "financial",
    "legal",
    "operational",
    "pitch",
    "customer",
    "hiring",
    "technical",
    "reference",
    "other",
  ]);
  return accepted.has(normalized) ? normalized : "other";
}

export function normalizeAuthoritativeness(value: unknown): string {
  const normalized = asString(value, "").toLowerCase();
  const accepted = new Set(["primary", "secondary", "derivative"]);
  return accepted.has(normalized) ? normalized : "secondary";
}

export function normalizeRelevance(value: unknown): string {
  const normalized = asString(value, "").toLowerCase();
  const accepted = new Set(["high", "medium", "low"]);
  return accepted.has(normalized) ? normalized : "medium";
}

export function normalizeSeverity(value: unknown): string {
  const normalized = asString(value, "").toLowerCase();
  const accepted = new Set([
    "blocker",
    "critical",
    "high",
    "medium",
    "low",
    "info",
  ]);
  return accepted.has(normalized) ? normalized : "medium";
}

export function normalizePriority(value: unknown): string {
  const normalized = asString(value, "").toLowerCase();
  const accepted = new Set(["blocker", "high", "medium", "low"]);
  return accepted.has(normalized) ? normalized : "medium";
}

export function normalizeQuestionCategory(value: unknown): DiligenceCoreQuestion {
  const accepted = new Set<DiligenceCoreQuestion>([
    "Q1_IDENTITY",
    "Q2_PRODUCT",
    "Q3_MARKET",
    "Q4_EXECUTION",
    "Q5_BUSINESS_MODEL",
    "Q6_RISKS",
    "Q7_EVIDENCE",
    "Q8_FAILURE_MODES",
  ]);
  const normalized = asString(value, "").toUpperCase();
  return accepted.has(normalized as DiligenceCoreQuestion)
    ? (normalized as DiligenceCoreQuestion)
    : "Q7_EVIDENCE";
}

// ───────────────────────── Chunk-ref discovery ─────────────────────────

export function collectChunkRefsFromStructured(
  structured: Record<string, unknown>
): string[] {
  const refs = new Set<string>();
  const overall = structured.chunk_refs_overall ?? structured.chunkRefsOverall;
  for (const ref of asStringArray(overall)) {
    refs.add(ref);
  }
  visitForChunkRefs(structured, refs);
  return Array.from(refs);
}

function visitForChunkRefs(value: unknown, sink: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) visitForChunkRefs(entry, sink);
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const refs = record.chunk_refs ?? record.chunkRefs;
    for (const ref of asStringArray(refs)) sink.add(ref);
    for (const child of Object.values(record)) visitForChunkRefs(child, sink);
  }
}

// ───────────────────────── DB-backed shared helpers ─────────────────────────

export async function loadChunkSourceMap(jobId: string): Promise<ChunkSourceMap> {
  const chunks = await db.diligenceChunk.findMany({
    where: { jobId },
    select: { id: true, documentPathname: true },
  });
  const map: ChunkSourceMap = new Map();
  for (const chunk of chunks) {
    map.set(chunk.id, chunk.documentPathname);
  }
  return map;
}

export async function loadLlmCredentials(
  ctx: StageContext
): Promise<LlmCredentials> {
  if (!ctx.userApiKeyId) {
    throw new DiligenceFatalError(
      "Missing user API key reference for diligence job."
    );
  }
  const selectedKey = await UserApiKeyModel.findByIdForUser({
    userId: ctx.userId,
    userApiKeyId: ctx.userApiKeyId,
  });
  if (!selectedKey || !selectedKey.enabled) {
    throw new DiligenceFatalError("Selected API key is missing or disabled.");
  }
  const primaryApiKey = UserApiKeyModel.decryptApiKey(selectedKey.encryptedKey);
  const fallbacks: LlmCredentials["fallbacks"] = [];
  for (const provider of ctx.fallbackProviders) {
    const key = await UserApiKeyModel.findForUser({
      userId: ctx.userId,
      provider,
    });
    if (!key || !key.enabled) {
      continue;
    }
    fallbacks.push({
      provider: key.provider,
      model: key.defaultModel ?? ctx.selectedModel,
      apiKey: UserApiKeyModel.decryptApiKey(key.encryptedKey),
    });
  }
  return {
    primary: {
      provider: ctx.selectedProvider,
      model: ctx.selectedModel,
      apiKey: primaryApiKey,
    },
    fallbacks,
  };
}
