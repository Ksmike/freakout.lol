import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/components/auth/RegisterForm";

vi.mock("@/lib/actions/auth", () => ({
  register: vi.fn(),
}));

describe("RegisterForm", () => {
  it("renders name, email, and password fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("button", { name: "Create account" })
    ).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    render(<RegisterForm />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("password input has minLength of 8", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "minLength",
      "8"
    );
  });

  it("name field is not required", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Name")).not.toBeRequired();
  });

  it("email field is required", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Email")).toBeRequired();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText("Password");
    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toBeInTheDocument();
  });
});
