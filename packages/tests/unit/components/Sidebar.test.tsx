import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";

vi.mock("@/lib/active-firm", () => ({
  getActiveFirmIdFromCookie: vi.fn().mockResolvedValue(null),
  setActiveFirmCookie: vi.fn().mockResolvedValue(undefined),
  clearActiveFirmCookie: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/actions/firm", () => ({
  switchFirm: vi.fn(),
  listUserFirms: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/actions/auth", () => ({
  logout: vi.fn(),
}));

const mockPathname = vi.fn().mockReturnValue("/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

const mockGetProjectForSidebar = vi.fn();
const mockGetRecentProjects = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/actions/sidebar", () => ({
  getProjectForSidebar: (...args: unknown[]) => mockGetProjectForSidebar(...args),
  getRecentProjects: (...args: unknown[]) => mockGetRecentProjects(...args),
}));

describe("Sidebar — default nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Dashboard link", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("renders Settings link", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders Sign out button", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("Sidebar — project nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders project sub-nav links when on a project route", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
    });
    mockPathname.mockReturnValue("/project/p-1");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute("href", "/project/p-1");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Insights" })).toHaveAttribute(
        "href",
        "/project/p-1/insights"
      )
    );
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/project/p-1/report"
    );
    expect(screen.getByRole("link", { name: "Enquiries" })).toHaveAttribute(
      "href",
      "/project/p-1/enquiries"
    );
  });

  it("hides insights and reports links when the project has no data for them", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: false,
      hasReports: false,
      hasEnquiries: false,
    });
    mockPathname.mockReturnValue("/project/p-1");

    render(<Sidebar />);

    await waitFor(() => expect(screen.getByText("Alpha Project")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Insights" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Enquiries" })).not.toBeInTheDocument();
  });

  it("shows the project name once loaded", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
    });
    mockPathname.mockReturnValue("/project/p-1");
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByText("Alpha Project")).toBeInTheDocument());
  });

  it("renders a back link to /dashboard", () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
    });
    mockPathname.mockReturnValue("/project/p-1");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Projects/i })).toHaveAttribute("href", "/dashboard");
  });
});
