export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".txt",
  ".rtf",
  ".docx",
  ".pages",
  ".pdf",
  ".ppt",
  ".pptx",
  ".key",
  ".keynote",
] as const;
export const ALLOWED_DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.join(",");
export const ALLOWED_DOCUMENT_FORMATS_LABEL =
  ALLOWED_DOCUMENT_EXTENSIONS.join(", ");

const ALLOWED_DOCUMENT_EXTENSION_SET = new Set<string>(
  ALLOWED_DOCUMENT_EXTENSIONS
);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._() -]+$/;

function getLowercaseExtension(value: string): string {
  const lastDotIndex = value.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === value.length - 1) {
    return "";
  }
  return value.slice(lastDotIndex).toLowerCase();
}

function normalizeIdentifier(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue || !IDENTIFIER_PATTERN.test(trimmedValue)) {
    return null;
  }
  return trimmedValue;
}

function normalizePathSegment(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue || trimmedValue === "." || trimmedValue === "..") {
    return null;
  }
  if (!PATH_SEGMENT_PATTERN.test(trimmedValue)) {
    return null;
  }
  return trimmedValue;
}

export function sanitizeProjectId(projectId: string): string | null {
  return normalizeIdentifier(projectId);
}

export function sanitizeDocumentFilename(fileName: string): string | null {
  if (fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }

  const normalizedBasename = normalizePathSegment(fileName);
  if (!normalizedBasename) {
    return null;
  }

  const extension = getLowercaseExtension(normalizedBasename);
  if (!ALLOWED_DOCUMENT_EXTENSION_SET.has(extension)) {
    return null;
  }

  return normalizedBasename;
}

export function sanitizeDocumentPathSegments(segments: string[]): string | null {
  if (segments.length === 0) {
    return null;
  }

  const sanitizedSegments: string[] = [];
  for (const segment of segments) {
    const normalizedSegment = normalizePathSegment(segment);
    if (!normalizedSegment) {
      return null;
    }
    sanitizedSegments.push(normalizedSegment);
  }

  const extension = getLowercaseExtension(
    sanitizedSegments[sanitizedSegments.length - 1]
  );
  if (!ALLOWED_DOCUMENT_EXTENSION_SET.has(extension)) {
    return null;
  }

  return sanitizedSegments.join("/");
}

/**
 * Builds the firm-scoped blob prefix for a project.
 * New path format: {firmId}/{projectId}/
 *
 * This replaced the old userId-based format ({userId}/{projectId}/).
 * Use buildLegacyProjectBlobPrefix for reading old blobs during migration.
 */
export function buildProjectBlobPrefix(
  firmId: string,
  projectId: string
): string | null {
  const normalizedFirmId = normalizeIdentifier(firmId);
  const normalizedProjectId = sanitizeProjectId(projectId);

  if (!normalizedFirmId || !normalizedProjectId) {
    return null;
  }

  return `${normalizedFirmId}/${normalizedProjectId}/`;
}

/**
 * Legacy prefix using userId — used only during blob migration.
 * @deprecated Use buildProjectBlobPrefix with firmId instead.
 */
export function buildLegacyProjectBlobPrefix(
  userId: string,
  projectId: string
): string | null {
  const normalizedUserId = normalizeIdentifier(userId);
  const normalizedProjectId = sanitizeProjectId(projectId);

  if (!normalizedUserId || !normalizedProjectId) {
    return null;
  }

  return `${normalizedUserId}/${normalizedProjectId}/`;
}

export function buildProjectBlobPath(
  firmId: string,
  projectId: string,
  documentPath: string
): string | null {
  const prefix = buildProjectBlobPrefix(firmId, projectId);
  if (!prefix) {
    return null;
  }

  const normalizedPath = sanitizeDocumentPathSegments(documentPath.split("/"));
  if (!normalizedPath) {
    return null;
  }

  return `${prefix}${normalizedPath}`;
}

export function getFilenameFromProjectBlobPath(
  pathname: string,
  prefix: string
): string {
  if (!pathname.startsWith(prefix)) {
    return pathname;
  }
  return pathname.slice(prefix.length);
}
