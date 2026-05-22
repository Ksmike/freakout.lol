import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileSidebar } from "@/components/MobileSidebar";

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
vi.mock("@/lib/actions/sidebar", () => ({
  getProjectForSidebar: (...args: unknown[]) => mockGetProjectForSidebar(...args),
}));

describe("MobileSidebar — default nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hamburger button", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<MobileSidebar />);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("opens sidebar on hamburger click", async () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes sidebar on close button click", async () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    const aside = screen.getByRole("complementary", { hidden: true });
    expect(aside.className).toContain("-translate-x-full");
  });
});

describe("MobileSidebar — project nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows project sub-nav when on a project route", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
    });
    mockPathname.mockReturnValue("/project/p-1");
    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
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

  it("hides insights and reports when they are unavailable", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: false,
      hasReports: false,
      hasEnquiries: false,
    });
    mockPathname.mockReturnValue("/project/p-1");

    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
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
    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(screen.getByText("Alpha Project")).toBeInTheDocument());
  });

  it("renders a back link to /dashboard", async () => {
    mockGetProjectForSidebar.mockResolvedValue({
      id: "p-1",
      name: "Alpha Project",
      hasInsights: true,
      hasReports: true,
      hasEnquiries: true,
    });
    mockPathname.mockReturnValue("/project/p-1");
    render(<MobileSidebar />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("link", { name: /Projects/i })).toHaveAttribute("href", "/dashboard");
  });
});
