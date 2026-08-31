import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import PlayWithAISettingsPage from "./page";

vi.mock("@/clients/PlayWithAISettingsClient", () => ({
  default: () => <div data-testid="play-ai-client">Play AI Client</div>,
}));

describe("PlayWithAISettingsPage - TypeScript Strictness", () => {
  test("page resolves to a valid React element", () => {
    const { container } = render(<PlayWithAISettingsPage />);
    expect(container.firstChild).toBeDefined();
  });

  test("component is typed as a function returning JSX", () => {
    expect(typeof PlayWithAISettingsPage).toBe("function");
  });

  test("renders without throwing", () => {
    expect(() => render(<PlayWithAISettingsPage />)).not.toThrow();
  });

  test("renders the PlayWithAISettingsClient inside the page", () => {
    const { getByTestId } = render(<PlayWithAISettingsPage />);
    expect(getByTestId("play-ai-client")).toBeInTheDocument();
  });
});
