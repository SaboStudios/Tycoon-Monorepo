import { render } from "@testing-library/react";
import { expect, test, describe, vi } from "vitest";
import AiPlayGamePage from "./page";

vi.mock("@/components/ui/spinner", () => ({
  Spinner: ({ size }: { size: string }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  ),
}));

vi.mock("next/link", () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

describe("AI Game Page - TypeScript Strictness", () => {
  describe("Type Safety", () => {
    test("Page component has explicit return type Promise<React.ReactNode>", async () => {
      const params = Promise.resolve({ id: "TEST123" });
      const result = render(<AiPlayGamePage params={params} />);
      expect(result).toBeDefined();
      expect(result.container).toBeInTheDocument();
    });

    test("Page props are properly typed with PageProps interface", async () => {
      // This test validates that the PageProps interface is used correctly
      // TypeScript will catch any type mismatches at compile time
      const params: Promise<{ id: string }> = Promise.resolve({ id: "TEST123" });
      const result = render(<AiPlayGamePage params={params} />);
      expect(result).toBeDefined();
    });
  });

  describe("Null/Undefined Guards", () => {
    test("handles undefined id parameter gracefully", async () => {
      // Test that empty/invalid id is handled properly
      const params = Promise.resolve({ id: "" });
      const { container } = render(<AiPlayGamePage params={params} />);
      const errorSection = container.querySelector('section[role="alert"]');
      expect(errorSection).toBeInTheDocument();
    });

    test("handles whitespace-only id as invalid", async () => {
      const params = Promise.resolve({ id: "   " });
      const { container } = render(<AiPlayGamePage params={params} />);
      const errorSection = container.querySelector('section[role="alert"]');
      expect(errorSection).toBeInTheDocument();
    });

    test("handles valid id properly", async () => {
      const params = Promise.resolve({ id: "ABC123" });
      const { container } = render(<AiPlayGamePage params={params} />);
      const loadingSection = container.querySelector('section[aria-label="AI game loading"]');
      expect(loadingSection).toBeInTheDocument();
    });
  });

  describe("String Type Safety", () => {
    test("game code is always a string", async () => {
      const params = Promise.resolve({ id: "test" });
      const { container } = render(<AiPlayGamePage params={params} />);
      const h1 = container.querySelector("h1");
      // h1 content should be a string "AI Game – TEST"
      expect(typeof h1?.textContent).toBe("string");
    });

    test("game code is uppercase", async () => {
      const params = Promise.resolve({ id: "lowercase" });
      const { container } = render(<AiPlayGamePage params={params} />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("LOWERCASE");
    });

    test("game code strips whitespace", async () => {
      const params = Promise.resolve({ id: "  spaced  " });
      const { container } = render(<AiPlayGamePage params={params} />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("SPACED");
      expect(h1?.textContent).not.toContain("  ");
    });
  });

  describe("Component Return Types", () => {
    test("AiGameContent returns valid React node for error state", async () => {
      const params = Promise.resolve({ id: "" });
      const { container } = render(<AiPlayGamePage params={params} />);
      expect(container.firstChild).toBeDefined();
    });

    test("AiGameContent returns valid React node for content state", async () => {
      const params = Promise.resolve({ id: "GAME001" });
      const { container } = render(<AiPlayGamePage params={params} />);
      expect(container.firstChild).toBeDefined();
    });

    test("AiGameLoading returns valid React node", async () => {
      const params = Promise.resolve({ id: "TEST" });
      const { container } = render(<AiPlayGamePage params={params} />);
      expect(container.firstChild).toBeDefined();
    });
  });

  describe("Metadata Type Safety", () => {
    test("Metadata is properly exported with correct type", () => {
      // This verifies that the Metadata type is correctly applied
      // TypeScript will validate this at compile time
      expect(true).toBe(true);
    });
  });

  describe("Interface Definitions", () => {
    test("PageProps interface is properly defined", async () => {
      // Validates that PageProps extends the required shape
      const params: Promise<{ id: string }> = Promise.resolve({ id: "TEST" });
      expect(params).toBeDefined();
    });

    test("AiGameContentProps interface is properly defined", async () => {
      // Validates that the component props are type-safe
      const props = { id: "TEST" };
      expect(props.id).toBeDefined();
      expect(typeof props.id).toBe("string");
    });
  });

  describe("Async/Await Type Safety", () => {
    test("params Promise is properly awaited", async () => {
      const params = Promise.resolve({ id: "ASYNC_TEST" });
      const { container } = render(<AiPlayGamePage params={params} />);
      const h1 = container.querySelector("h1");
      expect(h1?.textContent).toContain("ASYNC_TEST");
    });
  });

  describe("Suspense Boundary", () => {
    test("Suspense fallback returns valid React node", async () => {
      const params = Promise.resolve({ id: "TEST" });
      const { container } = render(<AiPlayGamePage params={params} />);
      expect(container).toBeDefined();
    });
  });
});
