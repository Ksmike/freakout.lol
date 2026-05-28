import { describe, expect, it } from "vitest";
import {
  buildProjectBlobPath,
  buildProjectBlobPrefix,
  getFilenameFromProjectBlobPath,
  sanitizeDocumentFilename,
  sanitizeDocumentPathSegments,
  sanitizeProjectId,
} from "@/lib/blob/documents";

describe("blob document path helpers", () => {
  it("validates project IDs", () => {
    expect(sanitizeProjectId("project-1")).toBe("project-1");
    expect(sanitizeProjectId(" project_2 ")).toBe("project_2");
    expect(sanitizeProjectId("project/2")).toBeNull();
    expect(sanitizeProjectId("")).toBeNull();
  });

  it("validates document filenames and extensions", () => {
    expect(sanitizeDocumentFilename("notes.txt")).toBe("notes.txt");
    expect(sanitizeDocumentFilename("nycemail.rtf")).toBe("nycemail.rtf");
    expect(sanitizeDocumentFilename("report.PDF")).toBe("report.PDF");
    expect(sanitizeDocumentFilename("deck.pptx")).toBe("deck.pptx");
    expect(sanitizeDocumentFilename("slides.PPT")).toBe("slides.PPT");
    expect(sanitizeDocumentFilename("presentation.key")).toBe("presentation.key");
    expect(sanitizeDocumentFilename("bad.exe")).toBeNull();
    expect(sanitizeDocumentFilename("deep/path/report.PDF")).toBeNull();
    expect(sanitizeDocumentFilename("../bad.pdf")).toBeNull();
  });

  it("validates document path segments", () => {
    expect(sanitizeDocumentPathSegments(["reports", "final.pdf"])).toBe(
      "reports/final.pdf"
    );
    expect(sanitizeDocumentPathSegments(["emails", "nycemail.rtf"])).toBe(
      "emails/nycemail.rtf"
    );
    expect(sanitizeDocumentPathSegments(["decks", "investor.pptx"])).toBe(
      "decks/investor.pptx"
    );
    expect(sanitizeDocumentPathSegments(["..", "final.pdf"])).toBeNull();
    expect(sanitizeDocumentPathSegments(["reports", "final.exe"])).toBeNull();
  });

  it("builds project-specific blob prefix and path using firmId", () => {
    expect(buildProjectBlobPrefix("firm-1", "project-1")).toBe(
      "firm-1/project-1/"
    );
    expect(buildProjectBlobPath("firm-1", "project-1", "notes.txt")).toBe(
      "firm-1/project-1/notes.txt"
    );
    expect(buildProjectBlobPath("bad/firm", "project-1", "notes.txt")).toBeNull();
  });

  it("extracts file path from project prefix", () => {
    expect(
      getFilenameFromProjectBlobPath(
        "firm-1/project-1/reports/summary.pdf",
        "firm-1/project-1/"
      )
    ).toBe("reports/summary.pdf");
  });
});
