import { del, get } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { ProjectDocumentModel } from "@/lib/models/ProjectDocumentModel";
import { db } from "@/lib/db";
import {
  AuditAction,
  ProjectStatus,
} from "@/lib/generated/prisma/client";
import { FirmModel } from "@/lib/models/FirmModel";
import { AuditLogModel } from "@/lib/models/AuditLogModel";
import { logger, generateRequestId } from "@/lib/logger";
import {
  buildProjectBlobPath,
  sanitizeDocumentPathSegments,
  sanitizeProjectId,
} from "@/lib/blob/documents";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ projectId: string; documentPath: string[] }> }
) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { projectId, documentPath } = await params;
  const sanitizedProjectId = sanitizeProjectId(projectId);
  if (!sanitizedProjectId) {
    return Response.json({ error: "Invalid project ID." }, { status: 400 });
  }

  const sanitizedDocumentPath = sanitizeDocumentPathSegments(documentPath);
  if (!sanitizedDocumentPath) {
    return Response.json(
      {
        error:
          "Unsupported document format or path. Allowed: .txt, .docx, .pages, .pdf, .ppt, .pptx, .key, .keynote.",
      },
      { status: 400 }
    );
  }

  const pathname = buildProjectBlobPath(
    userId,
    sanitizedProjectId,
    sanitizedDocumentPath
  );
  if (!pathname) {
    return Response.json({ error: "Invalid storage path." }, { status: 400 });
  }

  try {
    const blob = await get(pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const headers = new Headers();
    if (blob.blob.contentType) {
      headers.set("content-type", blob.blob.contentType);
    }
    if (blob.blob.contentDisposition) {
      headers.set("content-disposition", blob.blob.contentDisposition);
    }
    if (blob.blob.cacheControl) {
      headers.set("cache-control", blob.blob.cacheControl);
    }

    headers.set("content-length", blob.blob.size.toString());
    headers.set("etag", blob.blob.etag);

    return new Response(blob.stream, {
      status: 200,
      headers,
    });
  } catch {
    return Response.json({ error: "Failed to read document." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ projectId: string; documentPath: string[] }> }
) {
  const requestId = generateRequestId();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { projectId, documentPath } = await params;
  const sanitizedProjectId = sanitizeProjectId(projectId);
  if (!sanitizedProjectId) {
    return Response.json({ error: "Invalid project ID." }, { status: 400 });
  }

  const sanitizedDocumentPath = sanitizeDocumentPathSegments(documentPath);
  if (!sanitizedDocumentPath) {
    return Response.json(
      {
        error:
          "Unsupported document format or path. Allowed: .txt, .docx, .pages, .pdf, .ppt, .pptx, .key, .keynote.",
      },
      { status: 400 }
    );
  }

  const pathname = buildProjectBlobPath(
    userId,
    sanitizedProjectId,
    sanitizedDocumentPath
  );
  if (!pathname) {
    return Response.json({ error: "Invalid storage path." }, { status: 400 });
  }

  try {
    await del(pathname);
    await ProjectDocumentModel.deleteForProjectPath({
      projectId: sanitizedProjectId,
      userId,
      pathname,
    });

    // Audit write (best-effort)
    FirmModel.ensureDefaultForUser(userId).then((firm) =>
      AuditLogModel.record({
        firmId: firm.firmId,
        actorUserId: userId,
        action: AuditAction.DOCUMENT_DELETED,
        targetType: "ProjectDocument",
        targetId: pathname,
        projectId: sanitizedProjectId,
        metadata: { pathname, requestId },
      })
    ).catch((err) => {
      logger.warn("delete.audit_failed", { requestId, userId, projectId: sanitizedProjectId }, err);
    });

    logger.info("document.deleted", {
      requestId,
      userId,
      projectId: sanitizedProjectId,
      pathname,
    });

    return Response.json({ deleted: true }, { status: 200 });
  } catch (err) {
    logger.error("document.delete_failed", {
      requestId,
      userId,
      projectId: sanitizedProjectId,
      pathname,
    }, err);
    return Response.json({ error: "Failed to delete document." }, { status: 500 });
  }
}

export async function PATCH(
  _request: Request,
  {
    params,
  }: { params: Promise<{ projectId: string; documentPath: string[] }> }
) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { projectId, documentPath } = await params;
  const sanitizedProjectId = sanitizeProjectId(projectId);
  if (!sanitizedProjectId) {
    return Response.json({ error: "Invalid project ID." }, { status: 400 });
  }

  const sanitizedDocumentPath = sanitizeDocumentPathSegments(documentPath);
  if (!sanitizedDocumentPath) {
    return Response.json(
      {
        error:
          "Unsupported document format or path. Allowed: .txt, .docx, .pages, .pdf, .ppt, .pptx, .key, .keynote.",
      },
      { status: 400 }
    );
  }

  const pathname = buildProjectBlobPath(
    userId,
    sanitizedProjectId,
    sanitizedDocumentPath
  );
  if (!pathname) {
    return Response.json({ error: "Invalid storage path." }, { status: 400 });
  }

  const updateResult = await ProjectDocumentModel.markQueuedForProjectPath({
    projectId: sanitizedProjectId,
    userId,
    pathname,
  });
  if (updateResult.count === 0) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  await db.project.updateMany({
    where: {
      id: sanitizedProjectId,
      userId,
    },
    data: {
      status: ProjectStatus.DRAFT,
    },
  });

  return Response.json({ reprocessQueued: true }, { status: 200 });
}
