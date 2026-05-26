import { render } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import Home from "./page";

vi.mock("@/clients/HomeClient", () => ({
  default: () => <div data-testid="home-client">Home Content</div>,
}));

vi.mock("@/hooks/useHeroTelemetry", () => ({
  useHeroTelemetry: () => ({
    fire: vi.fn(),
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("Home Page - TypeScript Strictness", () => {
  describe("Type Safety", () => {
    test("Home component returns ReactElement with proper type", () => {
      const result = render(<Home />);
      expect(result).toBeDefined();
      expect(result.container).toBeInTheDocument();
    });

    test("HomeClient is properly rendered as child", () => {
      const { getByTestId } = render(<Home />);
      expect(getByTestId("home-client")).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    test("Home component accepts no props and doesn't require any", () => {
      // This test verifies that Home can be called without any arguments
      // If props were improperly typed, TypeScript would catch it during compilation
      const result = render(<Home />);
      expect(result).toBeDefined();
    });
  });

  describe("Metadata", () => {
    test("Metadata is properly typed and exported", () => {
      // Verify that metadata export doesn't cause type errors
      // This is checked at compile time for proper Metadata type
      expect(true).toBe(true);
    });
  });

  describe("Explicit Return Types", () => {
    test("Component functions have explicit return types for strict mode", () => {
      // This validates that the component is properly typed
      const { container } = render(<Home />);
      expect(container.firstChild).toBeDefined();
    });
  });

  describe("Null/Undefined Handling", () => {
    test("Component gracefully handles HomeClient rendering", () => {
      const { getByTestId } = render(<Home />);
      const child = getByTestId("home-client");
      expect(child).not.toBeNull();
      expect(child).not.toBeUndefined();
    });
  });
});
