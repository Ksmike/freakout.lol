import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const mockNotFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>(
    "next/navigation"
  );
  return {
    ...actual,
    redirect: mockRedirect,
    notFound: mockNotFound,
  };
});

const mockFindByIdForUser = vi.fn();
vi.mock("@/lib/models/ProjectModel", () => ({
  ProjectModel: {
    findByIdForUser: mockFindByIdForUser,
  },
}));

const mockGetReportsForProject = vi.fn();
vi.mock("@/lib/models/DiligenceJobModel", () => ({
  DiligenceJobModel: {
    getReportsForProject: (...args: unknown[]) =>
      mockGetReportsForProject(...args),
  },
}));

const mockCheckSubscriptionAccess = vi.fn();
vi.mock("@/lib/authz/subscription-gate", () => ({
  checkSubscriptionAccess: (...args: unknown[]) =>
    mockCheckSubscriptionAccess(...args),
}));

vi.mock("@/components/PaywallOverlay", () => ({
  PaywallOverlay: () => <div>PaywallOverlay</div>,
}));

vi.mock("@/app/(app)/project/[id]/enquiries/EnquiriesView", () => ({
  EnquiriesView: ({ projectName }: { projectName: string }) => (
    <div>EnquiriesView:{projectName}</div>
  ),
}));

vi.mock("@/labels", () => ({
  getLabelsForLocale: vi.fn(() => ({
    locale: "en",
    labels: {
      app: {
        enquiries: {
          heading: "Enquiries",
          description: "Investor Q&A grounded in the completed diligence report and source files.",
          lockedTitle: "Enquiries unlock after a completed report.",
          lockedDescription:
            "Finish due diligence and generate a report first. Then you can ask investor-style follow-up questions here.",
          introMessage:
            "Ask me anything about this diligence report and the uploaded documents. I will answer using available evidence and call out any gaps.",
          sampleQuestionsHeading: "Try asking:",
          sampleQuestionOne: "What is the biggest risk that could break this deal?",
          sampleQuestionTwo: "Which claims have weak supporting evidence?",
          sampleQuestionThree: "What should we ask founders before IC?",
          sendCta: "Ask agent",
          sendingCta: "Analyzing…",
          investorLabel: "Investor",
          agentLabel: "Diligence agent",
          agentThinking: "Reviewing report and evidence…",
          sourcesHeading: "Evidence used",
          errorPrefix: "Enquiry failed",
          genericError: "Could not generate an answer for that question.",
          placeholder: "Ask a follow-up about the report or uploaded data...",
        },
        paywall: {
          heading: "Upgrade to unlock full insights",
          description: "Detailed findings are available on paid plans.",
          upgradeCta: "Upgrade now",
          priceNote: "Starting at $10/seat per month.",
          features: ["Full findings"],
          teaserRisksHeading: "High-risk findings detected",
        },
      },
    },
  })),
}));

const { default: EnquiriesPage } = await import(
  "@/app/(app)/project/[id]/enquiries/page"
);

describe("project enquiries page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckSubscriptionAccess.mockResolvedValue({ hasAccess: true });
  });

  it("redirects unauthenticated users to login", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      EnquiriesPage({ params: Promise.resolve({ id: "project-1" }) })
    ).rejects.toThrow("REDIRECT:/login?callbackUrl=/project/project-1/enquiries");
  });

  it("throws notFound when the project does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", locale: "en" } });
    mockFindByIdForUser.mockResolvedValue(null);

    await expect(
      EnquiriesPage({ params: Promise.resolve({ id: "missing" }) })
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders locked state when no completed report exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", locale: "en" } });
    mockFindByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Alpha Project",
      status: "draft",
      createdAt: new Date(),
    });
    mockGetReportsForProject.mockResolvedValue([]);

    const page = await EnquiriesPage({
      params: Promise.resolve({ id: "project-1" }),
    });

    render(page);
    expect(screen.getByText("Enquiries")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Alpha Project - Investor Q&A grounded in the completed diligence report and source files."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enquiries unlock after a completed report.")
    ).toBeInTheDocument();
  });

  it("renders enquiries chat view when a completed report exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", locale: "en" } });
    mockFindByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Alpha Project",
      status: "reviewed",
      createdAt: new Date(),
    });
    mockGetReportsForProject.mockResolvedValue([
      {
        id: "artifact-1",
        jobId: "job-1",
        stage: "FINAL_REPORT",
        type: "GENERATED_REPORT",
        mimeType: "application/json",
        sizeBytes: 1200,
        createdAt: new Date(),
        jobStatus: "COMPLETED",
        jobCompletedAt: new Date(),
      },
    ]);

    const page = await EnquiriesPage({
      params: Promise.resolve({ id: "project-1" }),
    });

    render(page);
    expect(screen.getByText("EnquiriesView:Alpha Project")).toBeInTheDocument();
  });

  it("renders paywall overlay for free users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", locale: "en" } });
    mockFindByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Alpha Project",
      status: "reviewed",
      createdAt: new Date(),
    });
    mockCheckSubscriptionAccess.mockResolvedValue({
      hasAccess: false,
      firmId: "firm-1",
      plan: "starter",
      billingStatus: "trialing",
    });

    const page = await EnquiriesPage({
      params: Promise.resolve({ id: "project-1" }),
    });

    render(page);
    expect(screen.getByText("Enquiries")).toBeInTheDocument();
    expect(screen.getByText("PaywallOverlay")).toBeInTheDocument();
  });
});
