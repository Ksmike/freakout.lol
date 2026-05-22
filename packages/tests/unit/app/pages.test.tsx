import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock child components used by pages
vi.mock("@/components/auth/LoginForm", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));
vi.mock("@/components/auth/RegisterForm", () => ({
  RegisterForm: () => <div data-testid="register-form" />,
}));
vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@/components/Header", () => ({
  Header: ({ user }: { user?: unknown }) => (
    <div data-testid="header" data-user={user ? "yes" : "no"} />
  ),
}));
vi.mock("@/components/Footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));
vi.mock("@/app/(app)/project/[id]/ProjectDocumentsPanel", () => ({
  ProjectDocumentsPanel: () => <div data-testid="project-documents-panel" />,
}));
vi.mock("@/app/(app)/project/[id]/ProjectHeader", () => ({
  ProjectHeader: ({
    projectName,
    projectStatusLabel,
    projectId,
  }: {
    projectName: string;
    projectStatusLabel: string;
    projectId: string;
  }) => (
    <div data-testid="project-header">
      <p>{projectName}</p>
      <p>{projectStatusLabel}</p>
      <p>{projectId}</p>
    </div>
  ),
}));
vi.mock("@/app/(app)/project/[id]/DeleteProjectButton", () => ({
  DeleteProjectButton: () => <div data-testid="delete-project-button" />,
}));
vi.mock("@/components/settings/ApiKeySection", () => ({
  ApiKeySection: () => <div data-testid="api-key-section" />,
}));
vi.mock("@/lib/actions/apiKeys", () => ({
  getApiKeyStatuses: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/actions/project", () => ({
  createProject: vi.fn(),
  startProjectDueDiligence: vi.fn(),
  retryProjectDueDiligence: vi.fn(),
}));

// Mock auth for marketing layout
const mockAuth = vi.fn().mockResolvedValue(null);
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

const mockProjectModel = {
  countByUserId: vi.fn(),
  listByUserId: vi.fn(),
  findByIdForUser: vi.fn(),
  createForUser: vi.fn(),
};
vi.mock("@/lib/models/ProjectModel", () => ({
  ProjectModel: mockProjectModel,
}));

const mockDiligenceJobModel = {
  findLatestWithStagesForProject: vi.fn().mockResolvedValue(null),
};
vi.mock("@/lib/models/DiligenceJobModel", () => ({
  DiligenceJobModel: mockDiligenceJobModel,
}));

// Mock labels for HomePage
vi.mock("@/labels", () => ({
  getLabelsForLocale: vi.fn().mockReturnValue({
    locale: "en",
    labels: {
      marketing: {
        hero: {
          badge: "Technology for Compliance",
          title: "Evidence-backed knowledge graphs for compliance workflows.",
          description:
            "SOC 2, ISO 27001, GDPR, and diligence workflows made easier...",
          trialCta: "Start Free Trial",
          demoCta: "View Live Workspace",
          segmentLabels: ["SOC 2", "GDPR"],
        },
        metrics: [
          { label: "Deals screened per month", value: "240+" },
          { label: "Median first-pass report", value: "36 hours" },
          { label: "Manual analyst effort reduced", value: "92%" },
        ],
        workflow: {
          heading: "How KG Qualify works",
          steps: [
            { title: "Collect", description: "Connect data rooms..." },
            { title: "Analyze", description: "Run automated checks..." },
            { title: "Decide", description: "Get an executive summary..." },
          ],
        },
        coverage: {
          heading: "Risk coverage teams trust",
          description: "Built for pre-investment...",
          items: ["Corporate and contract compliance"],
          outcomesTitle: "Pilot portfolio outcomes",
          outcomesParagraphs: ["Teams using KG Qualify..."],
        },
        taxonomy: {
          heading: "Built-in deal labels",
          description: "Standardized labels...",
          items: ["Data Quality", "Legal Risk"],
        },
        cta: {
          heading: "Ready to automate your next diligence cycle?",
          description: "Launch a workspace in minutes...",
          createWorkspaceCta: "Create Workspace",
          contactSalesCta: "Contact Sales",
          footnote: "Enterprise-ready API...",
        },
      },
      app: {
        dashboard: {
          heading: "Dashboard",
          description: "Welcome back.",
          projectsHeading: "Projects",
          createProjectCta: "Create project",
          statusHeading: "Status",
          inspectCta: "Inspect",
          statuses: {
            draft: "draft",
            inprogress: "in progress",
            reviewed: "reviewed",
            complete: "complete",
            rejected: "rejected",
          },
        },
        projectInspect: {
          heading: "Project",
          statusLabel: "Status",
          createdLabel: "Created",
          idLabel: "Project ID",
          copyIdAriaLabel: "Copy project ID",
          copySuccessToast: "Project ID copied to clipboard.",
          copyErrorToast: "Could not copy project ID.",
          deleteProjectCta: "Delete project",
          deleteProjectConfirm:
            "Delete this project? Files, diligence jobs, and findings will be removed permanently.",
          deleteProjectInProgress: "Deleting...",
          deleteProjectSuccessToast: "Project deleted.",
          deleteProjectErrorToast: "Failed to delete project.",
          documentsHeading: "Files",
          fileInputLabel: "Upload files",
          uploadInProgress: "Uploading...",
          dropzoneTitle: "Drag and drop files to upload",
          dropzoneHint: "Files upload automatically after drop.",
          uploadQueueHeading: "Upload progress",
          uploadStatusQueued: "Queued",
          uploadStatusUploading: "Uploading",
          uploadStatusUploaded: "Uploaded",
          uploadStatusFailed: "Failed",
          emptyDocuments: "No files uploaded yet.",
          loadingDocuments: "Loading files...",
          loadError: "Failed to load files.",
          uploadError: "Failed to upload file.",
          viewFileCta: "View",
          deleteFileCta: "Delete",
          deleteInProgress: "Deleting...",
          deleteError: "Failed to delete file.",
          reprocessFileCta: "Re-process",
          reprocessInProgress: "Queueing...",
          reprocessError: "Failed to queue file for re-processing.",
          fileStatusLabel: "File status",
          fileProcessingStatuses: {
            QUEUED: "Queued",
            PROCESSING: "Processing",
            PROCESSED: "Processed",
            FAILED: "Failed",
          },
          beDiligentCta: "Be Diligent",
          providerSelectionLabel: "Provider",
          modelInputLabel: "Model",
          modelInputPlaceholder: "gpt-4o-mini",
          fallbackProvidersLabel: "Fallback providers",
          retryDiligenceCta: "Retry diligence",
          cancelDiligenceCta: "Cancel diligence",
          cancelDiligenceConfirm: "Cancel the running diligence workflow?",
          cancelDiligenceToast: "Diligence cancelled.",
          cancelDiligenceErrorToast: "Failed to cancel diligence.",
          diligenceProgressHeading: "Diligence worker",
          diligenceStatusLabel: "Job status",
          diligenceCurrentStageLabel: "Current stage",
          diligenceJobIdLabel: "Job ID",
          diligenceTokenUsageLabel: "Token usage",
          diligenceCostEstimateLabel: "Estimated cost",
          diligenceLastErrorLabel: "Last error",
          diligenceNoJobMessage: "No diligence job has started yet.",
          diligenceJobCreatedToast: "Due diligence job initialized.",
          diligenceRunningToast: "Diligence workflow running.",
          diligenceCompletedToast: "Due diligence job completed.",
          diligenceRetryToast: "Diligence retry started.",
          diligenceRetryErrorToast: "Failed to retry due diligence.",
          diligenceStatuses: {
            QUEUED: "Queued",
            RUNNING: "Running",
            WAITING_INPUT: "Waiting for Input",
            COMPLETED: "Completed",
            FAILED: "Failed",
            CANCELED: "Canceled",
          },
          diligenceStages: {
            DOCUMENT_EXTRACTION: "document extraction",
            DOCUMENT_CLASSIFICATION: "document classification",
            EVIDENCE_INDEXING: "evidence indexing",
            ENTITY_EXTRACTION: "entity extraction",
            CLAIM_EXTRACTION: "claim extraction",
            CORROBORATION: "corroboration",
            Q1_IDENTITY_AND_OWNERSHIP: "Q1: identity & ownership",
            Q2_PRODUCT_AND_TECHNOLOGY: "Q2: product & technology",
            Q3_MARKET_AND_TRACTION: "Q3: market & traction",
            Q4_EXECUTION_CAPABILITY: "Q4: execution capability",
            Q5_BUSINESS_MODEL_VIABILITY: "Q5: business model viability",
            Q6_RISK_ANALYSIS: "Q6: risk analysis",
            Q8_FAILURE_MODES_AND_FRAGILITY: "Q8: failure modes & fragility",
            OPEN_QUESTIONS: "open questions",
            EXECUTIVE_SUMMARY: "executive summary",
            FINAL_REPORT: "final report",
          },
          setupApiKeysMessage:
            "Add at least one API key in Settings to run due diligence.",
          setupApiKeysToast:
            "No API keys found. Opening Settings in a new tab.",
          diligenceStartToast: "Due diligence started.",
          insightsHeading: "Reviewed insights",
          insightsEmpty:
            "No reviewed insights yet. Run due diligence to generate findings.",
          insightsRisksHeading: "Top risks",
          insightsClaimsHeading: "Key claims",
          insightsEntitiesHeading: "Core entities",
          insightsContradictionsHeading: "Contradictions",
        },
        projectCreation: {
          heading: "Create project",
          description: "Name your project and attach the source files to start qualification.",
          nameLabel: "Project name",
          namePlaceholder: "Acme diligence workspace",
          filesLabel: "Files",
          filesHint: "You can upload one or more files now.",
          submitCta: "Create project",
        },
      },
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
});

describe("DashboardPage", () => {
  it("renders heading and welcome text when user has projects", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });
    mockProjectModel.listByUserId.mockResolvedValue([
      { id: "project-1", name: "Alpha Project", status: "inprogress" },
      { id: "project-2", name: "Beta Project", status: "complete" },
    ]);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const element = await DashboardPage();
    render(element);
    expect(
      screen.getByRole("heading", { name: "Dashboard" })
    ).toBeInTheDocument();
    expect(screen.getByText("Welcome back.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create project" })
    ).toHaveAttribute("href", "/projects/new");
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("complete")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Alpha Project/i })
    ).toHaveAttribute("href", "/project/project-1");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to project creation when user has no projects", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });
    mockProjectModel.listByUserId.mockResolvedValue([]);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );

    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/projects/new");
  });
});

describe("ProjectInspectPage", () => {
  it("renders project details", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });
    mockProjectModel.findByIdForUser.mockResolvedValue({
      id: "project-1",
      name: "Alpha Project",
      status: "inprogress",
      createdAt: new Date("2026-05-06T14:00:00.000Z"),
    });

    const { default: ProjectInspectPage } = await import(
      "@/app/(app)/project/[id]/page"
    );
    const element = await ProjectInspectPage({
      params: Promise.resolve({ id: "project-1" }),
    });
    render(element);

    expect(screen.getByTestId("project-header")).toBeInTheDocument();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("project-1")).toBeInTheDocument();
    expect(screen.getByTestId("project-documents-panel")).toBeInTheDocument();
  });

  it("calls notFound for an unknown project", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });
    mockProjectModel.findByIdForUser.mockResolvedValue(null);

    const { default: ProjectInspectPage } = await import(
      "@/app/(app)/project/[id]/page"
    );

    await expect(
      ProjectInspectPage({ params: Promise.resolve({ id: "missing-project" }) })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("ProjectCreationPage", () => {
  it("renders heading and project form", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });

    const { default: ProjectCreationPage } = await import(
      "@/app/(app)/projects/new/page"
    );
    const element = await ProjectCreationPage();
    render(element);

    expect(
      screen.getByRole("heading", { name: "Create project" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  it("renders heading and api key section", async () => {
    const { default: SettingsPage } = await import(
      "@/app/(app)/settings/page"
    );
    const element = await SettingsPage();
    render(element);
    expect(
      screen.getByRole("heading", { name: "Settings" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("api-key-section")).toBeInTheDocument();
  });
});

describe("LoginPage", () => {
  it("renders heading and login form", async () => {
    const { default: LoginPage } = await import("@/app/(auth)/login/page");
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Welcome back" })
    ).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  it("renders heading and register form", async () => {
    const { default: RegisterPage } = await import(
      "@/app/(auth)/register/page"
    );
    render(<RegisterPage />);
    expect(
      screen.getByRole("heading", { name: "Create an account" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Get started with KG Qualify")
    ).toBeInTheDocument();
    expect(screen.getByTestId("register-form")).toBeInTheDocument();
  });
});

describe("MarketingLayout", () => {
  it("renders header, footer, and children", async () => {
    const { default: MarketingLayout } = await import(
      "@/app/(marketing)/layout"
    );
    const element = await MarketingLayout({ children: <p>marketing content</p> });
    render(element);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByText("marketing content")).toBeInTheDocument();
  });
});

describe("HomePage", () => {
  it("renders hero heading", async () => {
    const { default: HomePage } = await import("@/app/(marketing)/page");
    render(<HomePage />);
    expect(
      screen.getByRole("heading", {
        name: /Evidence-backed knowledge graphs for compliance workflows/i,
      })
    ).toBeInTheDocument();
  });

  it("renders metrics", async () => {
    const { default: HomePage } = await import("@/app/(marketing)/page");
    render(<HomePage />);
    expect(screen.getByText("240+")).toBeInTheDocument();
    expect(screen.getByText("36 hours")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("renders workflow section", async () => {
    const { default: HomePage } = await import("@/app/(marketing)/page");
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "How KG Qualify works" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Collect" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Analyze" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Decide" })
    ).toBeInTheDocument();
  });

  it("renders CTA links", async () => {
    const { default: HomePage } = await import("@/app/(marketing)/page");
    render(<HomePage />);
    const registerLinks = screen.getAllByRole("link", {
      name: /Start Free Trial|Create Workspace/,
    });
    expect(registerLinks.length).toBeGreaterThanOrEqual(1);
  });
});
