import { get, list } from "@vercel/blob";
import { db } from "@/lib/db";
import { buildProjectBlobPrefix } from "@/lib/blob/documents";
import { extractDocument } from "@/lib/diligence/document-extractors";
import { DiligenceFatalError } from "@/lib/diligence/errors";
import {
  type StageContext,
  type StageExecutionResult,
  streamToBytes,
  toInputJson,
} from "@/lib/diligence/stage-helpers";
import {
  DiligenceArtifactType,
  DiligenceJobStatus,
  DiligenceStageName,
  DiligenceStorageProvider,
  ProjectDocumentProcessingStatus,
} from "@/lib/generated/prisma/client";

export async function runDocumentExtraction(
  ctx: StageContext
): Promise<StageExecutionResult> {
  const prefix = buildProjectBlobPrefix(ctx.firmId, ctx.projectId);
  if (!prefix) {
    throw new DiligenceFatalError("Invalid project storage prefix.");
  }

  const { blobs } = await list({ prefix });
  if (blobs.length === 0) {
    await db.diligenceJob.update({
      where: { id: ctx.jobId },
      data: {
        status: DiligenceJobStatus.WAITING_INPUT,
        errorMessage: "No documents uploaded yet.",
      },
    });
    return {
      outputJson: { items: [], summary: "No source documents available." },
    };
  }

  await db.projectDocument.updateMany({
    where: { projectId: ctx.projectId, userId: ctx.userId },
    data: {
      processingStatus: ProjectDocumentProcessingStatus.PROCESSING,
      processingError: null,
    },
  });

  const extractedItems: Array<{
    pathname: string;
    filename: string;
    sizeBytes: number;
    pages: Array<{ page: number | null; text: string }>;
    extractionMode: string;
    processingStatus: ProjectDocumentProcessingStatus;
    processingError: string | null;
    warnings: string[];
  }> = [];

  for (const blob of blobs) {
    const filename = blob.pathname.startsWith(prefix)
      ? blob.pathname.slice(prefix.length)
      : blob.pathname;

    let pages: Array<{ page: number | null; text: string }> = [];
    let extractionMode = "metadata_only";
    let warnings: string[] = [];
    let processingStatus: ProjectDocumentProcessingStatus =
      ProjectDocumentProcessingStatus.PROCESSED;
    let processingError: string | null = null;

    try {
      const blobResult = await get(blob.pathname, { access: "private" });
      if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
        throw new Error("Document stream unavailable.");
      }
      const bytes = await streamToBytes(blobResult.stream);
      const result = await extractDocument({ filename, bytes });
      pages = result.pages;
      extractionMode = result.extractionMode;
      warnings = result.warnings;
      if (
        result.extractionMode === "metadata_only" ||
        pages.every((page) => page.text.trim().length === 0)
      ) {
        processingError =
          warnings[0] ?? "No extractable text found in this document.";
      }
    } catch (error) {
      processingStatus = ProjectDocumentProcessingStatus.FAILED;
      processingError =
        error instanceof Error ? error.message : "Extraction failed.";
    }

    await db.projectDocument.upsert({
      where: {
        projectId_pathname: {
          projectId: ctx.projectId,
          pathname: blob.pathname,
        },
      },
      create: {
        projectId: ctx.projectId,
        userId: ctx.userId,
        filename,
        pathname: blob.pathname,
        sizeBytes: blob.size,
        processingStatus,
        processingError,
        lastProcessedAt:
          processingStatus === ProjectDocumentProcessingStatus.PROCESSED
            ? new Date()
            : null,
      },
      update: {
        filename,
        sizeBytes: blob.size,
        processingStatus,
        processingError,
        lastProcessedAt:
          processingStatus === ProjectDocumentProcessingStatus.PROCESSED
            ? new Date()
            : null,
      },
    });

    extractedItems.push({
      pathname: blob.pathname,
      filename,
      sizeBytes: blob.size,
      pages,
      extractionMode,
      processingStatus,
      processingError,
      warnings,
    });
  }

  await db.diligenceArtifact.deleteMany({
    where: {
      jobId: ctx.jobId,
      stage: DiligenceStageName.DOCUMENT_EXTRACTION,
    },
  });

  await db.diligenceArtifact.createMany({
    data: extractedItems.map((item) => ({
      projectId: ctx.projectId,
      jobId: ctx.jobId,
      userId: ctx.userId,
      stage: DiligenceStageName.DOCUMENT_EXTRACTION,
      type: DiligenceArtifactType.EXTRACTED_TEXT,
      storageProvider: DiligenceStorageProvider.JSON_COLUMN,
      storageKey: `db:project-document:${ctx.projectId}:${item.pathname}`,
      mimeType: "text/plain",
      sizeBytes: item.pages.reduce((sum, page) => sum + page.text.length, 0),
      checksum: null,
      metadata: toInputJson({
        pathname: item.pathname,
        filename: item.filename,
        extractionMode: item.extractionMode,
        warnings: item.warnings,
        processingStatus: item.processingStatus,
        processingError: item.processingError,
        pages: item.pages,
      }),
    })),
  });

  const processedCount = extractedItems.filter(
    (item) =>
      item.processingStatus === ProjectDocumentProcessingStatus.PROCESSED
  ).length;

  return {
    outputJson: {
      items: extractedItems.map((item) => ({
        pathname: item.pathname,
        filename: item.filename,
        sizeBytes: item.sizeBytes,
        extractionMode: item.extractionMode,
        processingStatus: item.processingStatus,
        processingError: item.processingError,
        warnings: item.warnings,
        pageCount: item.pages.length,
      })),
      summary: `Extracted text from ${processedCount}/${extractedItems.length} source document(s).`,
    },
  };
}
