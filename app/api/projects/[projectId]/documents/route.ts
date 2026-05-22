import { list, put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { ProjectDocumentModel } from "@/lib/models/ProjectDocumentModel";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { FirmModel } from "@/lib/models/FirmModel";
import { BillingModel } from "@/lib/models/BillingModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { AuditAction } from "@/lib/generated/prisma/client";
import { logger, generateRequestId } from "@/lib/logger";
import {
  buildProjectBlobPath,
  buildProjectBlobPrefix,
  getFilenameFromProjectBlobPath,
  sanitizeDocumentFilename,
  sanitizeProjectId,
} from "@/lib/blob/documents";

export const dynamic = "force-dynamic";

const INVALID_PROJECT_ID_ERROR = "Invalid project ID.";
const INVALID_DOCUMENT_ERROR =
  "Unsupported document format. Allowed: .txt, .docx, .pages, .pdf, .ppt, .pptx, .key, .keynote.";
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const UPLOAD_RATE_LIMIT_MAX = 25;
const UPLOAD_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1_000;

function getUserIdFromSession(session: {
  user?: { id?: string | null } | null;
} | null | undefined) {
  return session?.user?.id ?? null;
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const requestId = generateRequestId();
  const session = await auth();
  const userId = getUserIdFromSession(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { projectId } = await params;
  const sanitizedProjectId = sanitizeProjectId(projectId);
  if (!sanitizedProjectId) {
    return Response.json({ error: INVALID_PROJECT_ID_ERROR }, { status: 400 });
  }

  const uploadRateLimit = checkRateLimit({
    namespace: "upload:project-documents",
    identifier: `${userId}:${sanitizedProjectId}`,
    maxRequests: UPLOAD_RATE_LIMIT_MAX,
    windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
  });
  if (!uploadRateLimit.allowed) {
    return Response.json(
      { error: "Too many upload requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(uploadRateLimit.retryAfterSeconds),
        },
      }
    );
  }

  // Entitlement check: monthly upload limit
  const firm = await FirmModel.ensureDefaultForUser(userId);
  const uploadCheck = await BillingModel.checkUpload(firm.firmId);
  if (!uploadCheck.allowed) {
    logger.warn("upload.entitlement_denied", {
      requestId,
      userId,
      projectId: sanitizedProjectId,
      firmId: firm.firmId,
      reason: uploadCheck.reason,
    });
    return Response.json({ error: uploadCheck.reason }, { status: 402 });
  }

  // Look up firmId for blob path scoping
  const projectRecord = await (await import("@/lib/db")).db.project.findFirst({
    where: { id: sanitizedProjectId, userId },
    select: { firmId: true },
  });
  const blobScopeId = projectRecord?.firmId ?? userId; // fallback for legacy

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    if (isFileLike(fileEntry)) {
      file = fileEntry;
    }
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return Response.json({ error: "Missing file upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return Response.json(
      { error: "File is too large. Maximum upload size is 25 MB." },
      { status: 413 }
    );
  }

  const sanitizedFilename = sanitizeDocumentFilename(file.name);
  if (!sanitizedFilename) {
    return Response.json({ error: INVALID_DOCUMENT_ERROR }, { status: 400 });
  }

  const pathname = buildProjectBlobPath(
    blobScopeId,
    sanitizedProjectId,
    sanitizedFilename
  );
  if (!pathname) {
    return Response.json({ error: "Invalid storage path." }, { status: 400 });
  }

  try {
    const blob = await put(pathname, file, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: file.type || undefined,
    });

    const projectDocument = await ProjectDocumentModel.upsertFromBlob({
      projectId: sanitizedProjectId,
      userId,
      filename: sanitizedFilename,
      pathname: blob.pathname,
      sizeBytes: file.size,
      contentType: file.type || null,
      resetProcessingStatus: true,
    });

    // Increment usage meter and write audit log (best-effort)
    await Promise.all([
      BillingModel.incrementUploads(firm.firmId),
      AuditLogModel.record({
        firmId: firm.firmId,
        actorUserId: userId,
        action: AuditAction.DOCUMENT_UPLOADED,
        targetType: "ProjectDocument",
        targetId: projectDocument.id,
        projectId: sanitizedProjectId,
        metadata: { filename: sanitizedFilename, sizeBytes: file.size, requestId },
      }),
    ]).catch((err) => {
      logger.warn("upload.post_write_failed", { requestId, userId, projectId: sanitizedProjectId }, err);
    });

    logger.info("upload.completed", {
      requestId,
      userId,
      projectId: sanitizedProjectId,
      filename: sanitizedFilename,
      sizeBytes: file.size,
    });

    return Response.json(
      {
        document: {
          id: projectDocument.id,
          filename: sanitizedFilename,
          pathname: blob.pathname,
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          size: file.size,
          contentType: file.type || null,
          processingStatus: "QUEUED",
          processingError: null,
          lastProcessedAt: null,
          reprocessCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("upload.failed", {
      requestId,
      userId,
      projectId: sanitizedProjectId,
      filename: sanitizedFilename ?? "unknown",
    }, err);
    return Response.json({ error: "Failed to upload document." }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const userId = getUserIdFromSession(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { projectId } = await params;
  const sanitizedProjectId = sanitizeProjectId(projectId);
  if (!sanitizedProjectId) {
    return Response.json({ error: INVALID_PROJECT_ID_ERROR }, { status: 400 });
  }

  // Look up firmId for blob path scoping
  const projectForList = await (await import("@/lib/db")).db.project.findFirst({
    where: { id: sanitizedProjectId, userId },
    select: { firmId: true },
  });
  const listScopeId = projectForList?.firmId ?? userId;

  const prefix = buildProjectBlobPrefix(listScopeId, sanitizedProjectId);
  if (!prefix) {
    return Response.json({ error: "Invalid storage path." }, { status: 400 });
  }

  try {
    const { blobs, cursor, hasMore } = await list({ prefix });
    for (const blob of blobs) {
      const filename = getFilenameFromProjectBlobPath(blob.pathname, prefix);
      await ProjectDocumentModel.upsertFromBlob({
        projectId: sanitizedProjectId,
        userId,
        filename,
        pathname: blob.pathname,
        sizeBytes: blob.size,
        contentType: null,
      });
    }

    const projectDocuments = await ProjectDocumentModel.listForProject({
      projectId: sanitizedProjectId,
      userId,
    });
    const documentByPath = new Map(
      projectDocuments.map((document) => [document.pathname, document] as const)
    );

    const documents = blobs.map((blob) => {
      const filename = getFilenameFromProjectBlobPath(blob.pathname, prefix);
      const storedDocument = documentByPath.get(blob.pathname);
      return {
        id: storedDocument?.id ?? `${sanitizedProjectId}:${blob.pathname}`,
        filename,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        processingStatus: storedDocument?.processingStatus ?? "QUEUED",
        processingError: storedDocument?.processingError ?? null,
        lastProcessedAt: storedDocument?.lastProcessedAt ?? null,
        reprocessCount: storedDocument?.reprocessCount ?? 0,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        etag: blob.etag,
      };
    });

    return Response.json({ documents, cursor, hasMore });
  } catch {
    return Response.json({ error: "Failed to list documents." }, { status: 500 });
  }
}
