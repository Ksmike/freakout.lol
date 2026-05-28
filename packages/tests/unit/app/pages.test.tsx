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
vi.mock("@/lib/actions/firm", () => ({
  addFirmMemberByEmail: vi.fn(),
  getActiveFirmSummary: vi.fn().mockResolvedValue({
    id: "firm-1",
    name: "Default Firm",
    slug: "default-firm",
    role: "OWNER",
    plan: "starter",
    billingStatus: "trialing",
    permissions: [
      "audit.view",
      "billing.manage",
      "members.invite",
      "members.manage_roles",
      "projects.create",
    ],
  }),
  listFirmAuditLogs: vi.fn().mockResolvedValue([
    {
      id: "audit-1",
      action: "FIRM_MEMBER_ADDED",
      actorLabel: "Owner User",
      targetType: "FirmMembership",
      targetId: "member-1",
      createdAt: "2026-05-22T10:00:00.000Z",
    },
  ]),
  listFirmMembers: vi.fn().mockResolvedValue([
    {
      id: "member-1",
      name: "Owner User",
      email: "owner@example.com",
      role: "OWNER",
      status: "ACTIVE",
    },
  ]),
  listPendingInvitations: vi.fn().mockResolvedValue([]),
  revokeInvitation: vi.fn(),
  updateFirmMemberRole: vi.fn(),
}));
vi.mock("@/lib/actions/project", () => ({
  createProject: vi.fn(),
  startProjectDueDiligence: vi.fn(),
  retryProjectDueDiligence: vi.fn(),
}));

vi.mock("@/lib/actions/graph", () => ({
  listEnabledGraphs: vi.fn().mockResolvedValue([]),
  listAvailableGraphs: vi.fn().mockResolvedValue([]),
  enableGraph: vi.fn(),
  disableGraph: vi.fn(),
  getProjectGoalWithRequirements: vi.fn().mockResolvedValue(null),
  getProjectGaps: vi.fn().mockResolvedValue([]),
  getProjectMappings: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {},
  getStripeWebhookSecret: vi.fn(),
}));

vi.mock("@/lib/actions/billing", () => ({
  getBillingSummary: vi.fn().mockResolvedValue({
    plan: "starter",
    billingStatus: "trialing",
    hasStripeCustomer: false,
    subscription: null,
    entitlement: {
      maxSeats: 1,
      maxProjects: 3,
      maxUploadsMonth: 20,
      maxRunsMonth: 5,
      maxExportsMonth: 10,
    },
    usage: {
      uploadsCount: 2,
      runsCount: 1,
      exportsCount: 0,
    },
  }),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  cancelSubscriptionAtPeriodEnd: vi.fn(),
  syncCheckoutSession: vi.fn().mockResolvedValue({ status: "synced" }),
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
  getCompletedSnapshotsForProject: vi.fn().mockResolvedValue([]),
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
          badge: "Open Source",
          title: "Knowledge-graph interrogations & investigation.",
          description:
            "Define ontologies, upload documents, and let the platform annotate...",
          trialCta: "Get Started",
          demoCta: "See It in Action",
          segmentLabels: ["Due Diligence", "Research"],
        },
        metrics: [
          { label: "Deals screened per month", value: "240+" },
          { label: "Median first-pass report", value: "36 hours" },
          { label: "Manual analyst effort reduced", value: "92%" },
        ],
        workflow: {
          heading: "How Freakout works",
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
          outcomesParagraphs: ["Teams using Freakout..."],
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
          emptyProjects: "No projects yet. Create a project to begin your investigation.",
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
          diligenceFailedStageLabel: "Failed stage",
          diligenceAttemptsLabel: "Attempts",
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
          assistanceGoalLabel: "Workflow",
          assistanceGoalHint: "Select a knowledge graph workflow.",
          noGoalLabel: "No workflow",
          noGoalHint: "Run without a structured workflow.",
        },
        settings: {
          heading: "Settings",
          description: "Manage your firm workspace and provider configuration.",
          accountNavLabel: "Account & firm",
          billingNavLabel: "Billing",
          apiKeysNavLabel: "API keys",
          workflowsNavLabel: "Workflows",
          accountHeading: "Account & firm",
          accountDescription: "Review your contact details.",
          contactHeading: "Contact",
          contactDescription: "Your signed-in account details.",
          contactNameLabel: "Name",
          contactEmailLabel: "Email",
          contactLocaleLabel: "Locale",
          firmHeading: "Firm workspace",
          firmDescription:
            "Your active firm controls project access, billing, graph workflows, and role-based permissions.",
          firmNameLabel: "Firm",
          firmRoleLabel: "Role",
          firmPlanLabel: "Plan",
          firmBillingLabel: "Billing",
          firmPermissionsLabel: "Enabled permissions",
          membersHeading: "Members",
          membersDescription:
            "Add existing users to this firm and manage their workspace role.",
          memberEmailLabel: "Email",
          memberRoleLabel: "Role",
          memberAddCta: "Add member",
          memberUpdateCta: "Update role",
          pendingInvitationsHeading: "Pending invitations",
          pendingInvitationExpiresLabel: "expires",
          revokeInvitationCta: "Revoke",
          auditHeading: "Audit log",
          auditDescription: "Recent privileged actions in this firm workspace.",
          auditEmpty: "No audit events recorded yet.",
          apiKeysHeading: "AI Provider Keys",
          apiKeysDescription: "Bring your own API keys.",
          encryptionNote: "Keys are stored encrypted.",
          billingHeading: "Billing & plan",
          billingDescription: "Manage your subscription, view usage, and upgrade your plan.",
          billingPlanLabel: "Plan",
          billingStatusLabel: "Status",
          billingPeriodEndLabel: "Renews",
          billingCancelsLabel: "cancels",
          billingUsageHeading: "This month's usage",
          billingUploadsLabel: "Uploads",
          billingRunsLabel: "Diligence runs",
          billingExportsLabel: "Exports",
          billingUpgradeCta: "Upgrade plan",
          billingManageCta: "Manage billing",
          billingCancelCta: "Cancel subscription",
          billingCancelConfirm:
            "Cancel this subscription at the end of the current billing period?",
          billingNoSubscription: "No active subscription. Upgrade to unlock higher limits.",
          billingManageToCancel:
            "Use Manage billing to update payment details, invoices, or cancel in Stripe.",
          billingActiveSubscription: "Your subscription is active.",
          billingCancelScheduled:
            "Your subscription is scheduled to cancel at the end of the current billing period.",
          billingSuccessHeading: "Subscription confirmed",
          billingSuccessDescription: "Stripe confirmed your checkout.",
          billingPendingHeading: "Subscription is being finalized",
          billingPendingDescription: "Refresh shortly if the plan does not update.",
          billingCanceledHeading: "Checkout canceled",
          billingCanceledDescription: "No subscription changes were made.",
          billingSyncErrorHeading: "Billing sync needs attention",
          billingSyncErrorDescription: "Could not verify the subscription.",
        },
        draft: {
          heading: "Output draft",
          description: "Source-backed draft.",
          noDataHeading: "No draft available",
          noDataDescription: "Complete a diligence run with a workflow selected.",
          sectionsLabel: "Sections covered",
          confidenceLabel: "Avg. confidence",
          openQuestionsLabel: "Open questions",
          openQuestionsHeading: "Open questions for founders",
          keyClaimsHeading: "Key claims",
          findingsHeading: "Findings",
          gapsHeading: "Evidence gaps",
        },
        graphWorkflow: {
          enabledGraphsHeading: "Knowledge graph workflows",
          enabledGraphsDescription: "Enable structured workflows.",
          availableGraphsHeading: "Available workflows",
          noGraphsAvailable: "No published workflows available.",
          enableCta: "Enable",
          disableCta: "Disable",
          enabledBadge: "Enabled",
          requirementsCount: "requirements",
          goalLabel: "Workflow",
          goalNone: "None",
          requirementsHeading: "Evidence requirements",
          requirementsEmpty: "No requirements defined.",
          gapsHeading: "Evidence gaps",
          gapsEmpty: "All requirements are satisfied.",
          gapPriorityHigh: "High",
          gapPriorityMedium: "Medium",
          gapPriorityLow: "Low",
          mappingStatusOpen: "Open",
          mappingStatusPartial: "Partial",
          mappingStatusSatisfied: "Satisfied",
          mappingStatusWaived: "Waived",
          markSatisfiedCta: "Mark satisfied",
          markWaivedCta: "Waive",
          outputTemplatesHeading: "Output templates",
          outputTemplatesEmpty: "No output templates defined.",
          adminHeading: "Graph Studio",
          adminDescription: "Create, version, and publish knowledge graph workflows.",
          adminGraphsHeading: "Graph definitions",
          adminPublishCta: "Publish",
          adminDeprecateCta: "Deprecate",
          adminStatusDraft: "Draft",
          adminStatusPublished: "Published",
          adminStatusDeprecated: "Deprecated",
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

  it("renders a create-project empty state when user has no projects", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", locale: "en" },
    });
    mockProjectModel.listByUserId.mockResolvedValue([]);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );

    const element = await DashboardPage();
    render(element);

    expect(
      screen.getByText("No projects yet. Create a project to begin your investigation.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create project" })
    ).toHaveAttribute("href", "/projects/new");
    expect(mockRedirect).not.toHaveBeenCalled();
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
    const element = await ProjectCreationPage({ searchParams: Promise.resolve({}) });
    render(element);

    expect(
      screen.getByRole("heading", { name: "Create project" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
  });
});

describe("Settings pages", () => {
  it("redirects the settings index to account settings", async () => {
    const { default: SettingsIndexPage } = await import(
      "@/app/(app)/settings/page"
    );
    await expect(
      SettingsIndexPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/settings/account");
  });

  it("redirects billing return query params to billing settings", async () => {
    const { default: SettingsIndexPage } = await import(
      "@/app/(app)/settings/page"
    );
    await expect(
      SettingsIndexPage({
        searchParams: Promise.resolve({
          billing: "success",
          session_id: "cs_1",
        }),
      })
    ).rejects.toThrow(
      "REDIRECT:/settings/billing?billing=success&session_id=cs_1"
    );
  });

  it("renders account and firm settings", async () => {
    const { default: AccountSettingsPage } = await import(
      "@/app/(app)/settings/account/page"
    );
    const element = await AccountSettingsPage();
    render(element);
    expect(
      screen.getByRole("heading", { name: "Account & firm" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Firm workspace" })
    ).toBeInTheDocument();
    expect(screen.getByText("Default Firm")).toBeInTheDocument();
    expect(screen.getAllByText("OWNER").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Members" })
    ).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Audit log" })
    ).toBeInTheDocument();
    expect(screen.getByText("FIRM_MEMBER_ADDED")).toBeInTheDocument();
  });

  it("renders api key settings", async () => {
    const { default: ApiKeysSettingsPage } = await import(
      "@/app/(app)/settings/api-keys/page"
    );
    const element = await ApiKeysSettingsPage();
    render(element);
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
    const element = await RegisterPage({ searchParams: Promise.resolve({}) });
    render(element);
    expect(
      screen.getByRole("heading", { name: "Create an account" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Get started with Freakout")
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
        name: /Knowledge-graph interrogations & investigation/i,
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
      screen.getByRole("heading", { name: "How Freakout works" })
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
