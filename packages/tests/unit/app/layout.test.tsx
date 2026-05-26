import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/font/google — these are build-time transforms
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
}));

describe("RootLayout", () => {
  it("renders children", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    render(
      <RootLayout>
        <p>Hello World</p>
      </RootLayout>
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("exports metadata with title and description", async () => {
    const { metadata } = await import("@/app/layout");
    expect((metadata.title as string)).toContain("Freakout.lol");
    expect(metadata.description).toContain("Freakout");
  });
});
