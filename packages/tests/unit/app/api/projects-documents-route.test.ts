import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitBucketsForTests } from "@/lib/security/rate-limit";

const authMock = vi.fn();
const putMock = vi.fn();
const listMock = vi.fn();
const projectDocumentUpsertMock = vi.fn();
const projectDocumentFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@vercel/blob", () => ({
  put: putMock,
  list: listMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    projectDocument: {
      upsert: projectDocumentUpsertMock,
      findMany: projectDocumentFindManyMock,
    },
  },
}));

vi.mock("@/lib/models/FirmModel", () => ({
  FirmModel: {
    ensureDefaultForUser: vi.fn().mockResolvedValue({ firmId: "firm-1", role: "OWNER" }),
  },
}));

vi.mock("@/lib/models/BillingModel", () => ({
  BillingModel: {
    checkUpload: vi.fn().mockResolvedValue({ allowed: true }),
    incrementUploads: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/models/AuditLogModel", () => ({
  AuditLogModel: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  generateRequestId: vi.fn().mockReturnValue("test-req-id"),
}));

describe("projects documents API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitBucketsForTests();
    projectDocumentFindManyMock.mockResolvedValue([]);
    projectDocumentUpsertMock.mockResolvedValue({ id: "doc-1" });
  });

  it("uploads a supported private document into user/project path", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    putMock.mockResolvedValue({
      pathname: "user-1/project-1/report.pdf",
      url: "https://blob.local/private-url",
      downloadUrl: "https://blob.local/private-url?download=1",
    });

    const route = await import("@/app/api/projects/[projectId]/documents/route");

    const formData = new FormData();
    formData.set(
      "file",
      new File(["file body"], "report.pdf", { type: "application/pdf" })
    );

    const response = await route.POST(
      {
        formData: async () => formData,
      } as unknown as Request,
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(201);
    expect(putMock).toHaveBeenCalledWith(
      "user-1/project-1/report.pdf",
      expect.any(File),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
      })
    );

    const body = await response.json();
    expect(body.document.pathname).toBe("user-1/project-1/report.pdf");
  });

  it("uploads a supported PowerPoint document", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    putMock.mockResolvedValue({
      pathname: "user-1/project-1/investor-deck.pptx",
      url: "https://blob.local/private-url",
      downloadUrl: "https://blob.local/private-url?download=1",
    });

    const route = await import("@/app/api/projects/[projectId]/documents/route");

    const formData = new FormData();
    formData.set(
      "file",
      new File(["pptx body"], "investor-deck.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      })
    );

    const response = await route.POST(
      {
        formData: async () => formData,
      } as unknown as Request,
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(201);
    expect(putMock).toHaveBeenCalledWith(
      "user-1/project-1/investor-deck.pptx",
      expect.any(File),
      expect.objectContaining({
        access: "private",
      })
    );
  });

  it("rejects unsupported extensions", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const route = await import("@/app/api/projects/[projectId]/documents/route");

    const formData = new FormData();
    formData.set(
      "file",
      new File(["file body"], "script.exe", {
        type: "application/octet-stream",
      })
    );

    const response = await route.POST(
      {
        formData: async () => formData,
      } as unknown as Request,
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects files above the maximum upload size", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const route = await import("@/app/api/projects/[projectId]/documents/route");

    const tooLarge = new File(
      [new Uint8Array(26 * 1024 * 1024)],
      "large-report.pdf",
      { type: "application/pdf" }
    );
    const formData = new FormData();
    formData.set("file", tooLarge);

    const response = await route.POST(
      {
        formData: async () => formData,
      } as unknown as Request,
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(413);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rate-limits repeated uploads", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    putMock.mockResolvedValue({
      pathname: "user-1/project-1/report.pdf",
      url: "https://blob.local/private-url",
      downloadUrl: "https://blob.local/private-url?download=1",
    });

    const route = await import("@/app/api/projects/[projectId]/documents/route");
    const formData = new FormData();
    formData.set("file", new File(["file body"], "report.pdf", { type: "application/pdf" }));

    const postUpload = () =>
      route.POST(
        { formData: async () => formData } as unknown as Request,
        { params: Promise.resolve({ projectId: "project-1" }) }
      );
    const postUploadMany = async (times: number): Promise<void> => {
      if (times <= 0) {
        return;
      }
      await postUpload();
      await postUploadMany(times - 1);
    };
    await postUploadMany(25);

    const throttledResponse = await postUpload();

    expect(throttledResponse.status).toBe(429);
    expect(throttledResponse.headers.get("Retry-After")).not.toBeNull();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const route = await import("@/app/api/projects/[projectId]/documents/route");

    const response = await route.GET(
      new Request("http://localhost/api/projects/project-1/documents"),
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("lists private project documents scoped by user/project prefix", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listMock.mockResolvedValue({
      blobs: [
        {
          pathname: "user-1/project-1/folder/report.pdf",
          size: 42,
          uploadedAt: new Date("2026-05-06T00:00:00.000Z"),
          url: "https://blob.local/private-url",
          downloadUrl: "https://blob.local/private-url?download=1",
          etag: "blob-etag",
        },
      ],
      cursor: undefined,
      hasMore: false,
    });

    const route = await import("@/app/api/projects/[projectId]/documents/route");
    const response = await route.GET(
      new Request("http://localhost/api/projects/project-1/documents"),
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith({ prefix: "user-1/project-1/" });

    const body = await response.json();
    expect(body.documents).toEqual([
      expect.objectContaining({
        filename: "folder/report.pdf",
        pathname: "user-1/project-1/folder/report.pdf",
      }),
    ]);
  });
});
