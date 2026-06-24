import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import SettingsPage from "./page";

const { back } = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
}));

vi.mock("@/components/settings/AccountSettings", () => ({
  AccountSettings: () => <button type="button">Update email</button>,
}));

vi.mock("@/components/settings/NotificationSettings", () => ({
  NotificationSettings: () => <button type="button">Save preferences</button>,
}));

vi.mock("@/components/settings/DangerZone", () => ({
  DangerZone: () => <button type="button">Delete account</button>,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    back.mockReset();
  });

  test("provides labelled route landmarks and a status announcer", () => {
    const { container } = render(<SettingsPage />);

    expect(
      container.querySelector('main[aria-labelledby="settings-page-title"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toHaveAttribute("id", "settings-page-title");

    const status = container.querySelector("#settings-status-announcer");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  test("puts the skip link before the settings controls and targets the content region", () => {
    render(<SettingsPage />);

    const skipLink = screen.getByRole("link", { name: "Skip to settings" });
    const backButton = screen.getByRole("button", { name: "Go back" });
    const updateEmailButton = screen.getByRole("button", { name: "Update email" });
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    expect(skipLink).toHaveAttribute("href", "#settings-page-content");
    expect(focusables.indexOf(skipLink)).toBeLessThan(focusables.indexOf(backButton));
    expect(focusables.indexOf(backButton)).toBeLessThan(
      focusables.indexOf(updateEmailButton),
    );
    expect(skipLink.className).toContain("focus:not-sr-only");
    expect(skipLink.className).toContain("focus:ring-2");
  });

  test("keeps the back control labelled and functional", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Go back" }));

    expect(back).toHaveBeenCalledOnce();
  });
});
