import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceStageName } from "@/lib/generated/prisma/client";

const mockDb = {
  assistanceGoal: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/generated/prisma/client", () => ({
  DiligenceStageName: {
    DOCUMENT_EXTRACTION: "DOCUMENT_EXTRACTION",
    Q1_IDENTITY_AND_OWNERSHIP: "Q1_IDENTITY_AND_OWNERSHIP",
    Q2_PRODUCT_AND_TECHNOLOGY: "Q2_PRODUCT_AND_TECHNOLOGY",
    Q3_MARKET_AND_TRACTION: "Q3_MARKET_AND_TRACTION",
    Q4_EXECUTION_CAPABILITY: "Q4_EXECUTION_CAPABILITY",
    Q5_BUSINESS_MODEL_VIABILITY: "Q5_BUSINESS_MODEL_VIABILITY",
    Q6_RISK_ANALYSIS: "Q6_RISK_ANALYSIS",
    Q7_EVIDENCE_QUALITY: "Q7_EVIDENCE_QUALITY",
    Q8_FAILURE_MODES_AND_FRAGILITY: "Q8_FAILURE_MODES_AND_FRAGILITY",
  },
  DiligenceCoreQuestion: {
    Q1_IDENTITY: "Q1_IDENTITY",
    Q2_PRODUCT: "Q2_PRODUCT",
    Q3_MARKET: "Q3_MARKET",
    Q4_EXECUTION: "Q4_EXECUTION",
    Q5_BUSINESS_MODEL: "Q5_BUSINESS_MODEL",
    Q6_RISKS: "Q6_RISKS",
    Q7_EVIDENCE: "Q7_EVIDENCE",
    Q8_FAILURE_MODES: "Q8_FAILURE_MODES",
  },
  OntologyNodeKind: {
    QUESTION: "QUESTION",
    CONTROL: "CONTROL",
  },
}));

const { loadGraphQuestionPromptContext } = await import(
  "@/lib/diligence/graph-question-context"
);

describe("loadGraphQuestionPromptContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not query graph state for non-question stages", async () => {
    const context = await loadGraphQuestionPromptContext({
      projectId: "project-1",
      stage: "DOCUMENT_EXTRACTION" as DiligenceStageName,
    });

    expect(context).toBeNull();
    expect(mockDb.assistanceGoal.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the project has no graph goal", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue(null);

    const context = await loadGraphQuestionPromptContext({
      projectId: "project-1",
      stage: "Q1_IDENTITY_AND_OWNERSHIP" as DiligenceStageName,
    });

    expect(context).toBeNull();
  });

  it("formats the selected graph question and requirements", async () => {
    mockDb.assistanceGoal.findUnique.mockResolvedValue({
      graph: {
        name: "Commercial Due Diligence",
        slug: "commercial-due-diligence",
        nodes: [
          {
            slug: "identity-ownership",
            label: "Identity & Ownership",
            description: "Corporate structure and cap table.",
            kind: "QUESTION",
          },
        ],
        evidenceRequirements: [
          {
            title: "Regulatory licences and permits",
            description: "Any sector-specific licences required to operate.",
            priority: "medium",
            node: {
              slug: "identity-ownership",
              label: "Identity & Ownership",
              description: null,
              kind: "QUESTION",
            },
          },
          {
            title: "Cap table and ownership structure",
            description: "Current cap table showing all shareholders.",
            priority: "high",
            node: {
              slug: "identity-ownership",
              label: "Identity & Ownership",
              description: null,
              kind: "QUESTION",
            },
          },
          {
            title: "Unrelated control",
            description: null,
            priority: "high",
            node: {
              slug: "identity-ownership",
              label: "Identity & Ownership",
              description: null,
              kind: "CONTROL",
            },
          },
        ],
      },
    });

    const context = await loadGraphQuestionPromptContext({
      projectId: "project-1",
      stage: "Q1_IDENTITY_AND_OWNERSHIP" as DiligenceStageName,
    });
    const promptContext = context ?? "";

    expect(promptContext).toContain("Graph: Commercial Due Diligence");
    expect(promptContext).toContain("Question node: Identity & Ownership");
    expect(promptContext).toContain("Corporate structure and cap table.");
    expect(promptContext).toContain(
      "[high] Cap table and ownership structure - Current cap table"
    );
    expect(promptContext).toContain(
      "[medium] Regulatory licences and permits - Any sector-specific"
    );
    expect(promptContext).not.toContain("Unrelated control");
    expect(promptContext.indexOf("[high]")).toBeLessThan(
      promptContext.indexOf("[medium]")
    );
  });
});
