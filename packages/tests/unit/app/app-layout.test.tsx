import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
  navItems: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Settings", href: "/settings" },
  ],
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "1", name: "Test", email: "t@t.com", image: null },
  }),
}));

vi.mock("@/lib/actions/firm", () => ({
  listUserFirms: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/providers/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

vi.mock("@/components/MobileSidebar", () => ({
  MobileSidebar: () => <div data-testid="mobile-sidebar" />,
}));

describe("AppLayout", () => {
  it("renders sidebar and children", async () => {
    const { default: AppLayout } = await import("@/app/(app)/layout");
    render(await AppLayout({ children: <p>child content</p> }));
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("wraps children in Providers", async () => {
    const { default: AppLayout } = await import("@/app/(app)/layout");
    render(await AppLayout({ children: <p>wrapped</p> }));
    expect(screen.getByTestId("providers")).toBeInTheDocument();
  });
});
