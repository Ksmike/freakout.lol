import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/Header";

vi.mock("@/components/UserMenu", () => ({
  UserMenu: ({ user }: { user: { email?: string | null } }) => (
    <div data-testid="user-menu">{user.email}</div>
  ),
}));

describe("Header", () => {
  it("renders the brand link", () => {
    render(<Header />);
    const brandLink = screen.getByRole("link", { name: "KG Qualify" });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("renders navigation links", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Workflow" })).toHaveAttribute(
      "href",
      "/#workflow"
    );
    expect(screen.getByRole("link", { name: "Coverage" })).toHaveAttribute(
      "href",
      "/#coverage"
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });

  it("shows Sign in link when no user", () => {
    render(<Header />);
    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink).toHaveAttribute("href", "/login");
  });

  it("shows user menu when user is provided", () => {
    const user = { name: "Test User", email: "test@example.com", image: null };
    render(<Header user={user} />);
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
