import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getMock = vi.fn();
const delMock = vi.fn();
const deleteForProjectPathMock = vi.fn();
const markQueuedForProjectPathMock = vi.fn();
const projectUpdateManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    ensureDefaultForUser: vi.fn().mockResolvedValue({ firmId: "firm-1", role: "OWNER" }),
  },
}));

vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  generateRequestId: vi.fn().mockReturnValue("test-req-id"),
}));

vi.mock("@vercel/blob", () => ({
  get: getMock,
  del: delMock,
}));

vi.mock("@/lib/models/ProjectDocumentModel", () => ({
  ProjectDocumentModel: {
    deleteForProjectPath: deleteForProjectPathMock,
    markQueuedForProjectPath: markQueuedForProjectPathMock,
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: vi.fn().mockResolvedValue({ firmId: "firm-1" }),
      updateMany: projectUpdateManyMock,
    },
  },
}));

describe("project document read route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markQueuedForProjectPathMock.mockResolvedValue({ count: 1 });
    projectUpdateManyMock.mockResolvedValue({ count: 1 });
    deleteForProjectPathMock.mockResolvedValue({ count: 1 });
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["notes.txt"],
      }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when file extension is unsupported", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["notes.exe"],
      }),
    });

    expect(response.status).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 404 when document does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getMock.mockResolvedValue(null);

    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["folder", "report.pdf"],
      }),
    });

    expect(getMock).toHaveBeenCalledWith("firm-1/project-1/folder/report.pdf", {
      access: "private",
    });
    expect(response.status).toBe(404);
  });

  it("streams a private document when found", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getMock.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Hello private blob"));
          controller.close();
        },
      }),
      headers: new Headers(),
      blob: {
        url: "https://blob.local/private-url",
        downloadUrl: "https://blob.local/private-url?download=1",
        pathname: "firm-1/project-1/report.txt",
        contentDisposition: "inline",
        cacheControl: "private, max-age=0",
        uploadedAt: new Date("2026-05-06T00:00:00.000Z"),
        etag: "etag-123",
        contentType: "text/plain",
        size: 18,
      },
    });

    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["report.txt"],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("etag")).toBe("etag-123");
    expect(await response.text()).toBe("Hello private blob");
  });

  it("deletes a private document when found", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    delMock.mockResolvedValue(undefined);

    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["folder", "report.pdf"],
      }),
    });

    expect(delMock).toHaveBeenCalledWith("firm-1/project-1/folder/report.pdf");
    expect(deleteForProjectPathMock).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("queues a document for reprocessing", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const route = await import(
      "@/app/api/projects/[projectId]/documents/[...documentPath]/route"
    );

    const response = await route.PATCH(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: "project-1",
        documentPath: ["folder", "report.pdf"],
      }),
    });

    expect(markQueuedForProjectPathMock).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
      pathname: "firm-1/project-1/folder/report.pdf",
    });
    expect(projectUpdateManyMock).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
