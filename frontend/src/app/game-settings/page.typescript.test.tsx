import { render, screen, act } from "@testing-library/react";
import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import GameSettingsClient from "@/clients/GameSettingsClient";
import { GameSettings } from "@/components/settings/GameSettings";

vi.mock("@/components/settings/GameSettings", () => ({
  GameSettings: () => <div data-testid="game-settings">Game Settings</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => ({ confirmLeave: () => true }),
}));

vi.mock("@/components/settings/LocaleSwitcher", () => ({
  LocaleSwitcher: () => null,
}));

vi.mock("@/components/settings/ThemeSettingsCard", () => ({
  ThemeSettingsCard: () => null,
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GameSettingsClient - TypeScript Strictness", () => {
  describe("Return types", () => {
    test("renders a valid React element", async () => {
      const { container } = render(<GameSettingsClient />);
      await act(() => vi.runAllTimersAsync());
      expect(container.firstChild).toBeDefined();
    });
  });

  describe("Wallet check states", () => {
    test("renders checking state initially", () => {
      render(<GameSettingsClient />);
      expect(
        screen.getByText("Connecting to Stellar Network..."),
      ).toBeInTheDocument();
    });

    test("renders game settings after successful check", async () => {
      render(<GameSettingsClient />);
      await act(() => vi.runAllTimersAsync());
      expect(screen.getByTestId("game-settings")).toBeInTheDocument();
    });

    test("renders error state when checkWallet throws", async () => {
      vi.spyOn(global, "setTimeout").mockImplementationOnce(() => {
        throw new Error("Network error");
      });
      render(<GameSettingsClient />);
      await act(() => vi.runAllTimersAsync());
      expect(
        screen.getByRole("heading", { name: "Connection Failed" }),
      ).toBeInTheDocument();
    });

    test("checking state has no game settings rendered", () => {
      render(<GameSettingsClient />);
      expect(screen.queryByTestId("game-settings")).not.toBeInTheDocument();
    });
  });
});

describe("GameSettings - TypeScript Strictness", () => {
  test("renders without crashing", () => {
    const { container } = render(<GameSettings />);
    expect(container.firstChild).toBeDefined();
  });
});
