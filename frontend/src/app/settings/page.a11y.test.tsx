/**
 * #1480 Settings route — focus-order tests matching join-room a11y suite
 *
 * Mirrors the structure of:
 *  - frontend/src/components/settings/__tests__/JoinRoomPageContent.a11y.test.tsx
 *  - frontend/src/app/game-waiting/page.test.tsx (Focus order section)
 *
 * Verifies:
 *  1. Skip link is the first focusable element and targets #settings-page-content
 *  2. Skip link has sr-only + visible focus styles (focus:not-sr-only, focus:ring-2)
 *  3. Back button comes before all settings controls in DOM tab order
 *  4. Settings content region is reachable (tabIndex=-1, has id for skip target)
 *  5. Content region has focus-visible ring styles for descendant controls
 *  6. main landmark is labelled via aria-labelledby pointing at the h1
 *  7. h1 has the expected id (settings-page-title)
 *  8. Status announcer has role=status, aria-live=polite, aria-atomic=true
 *  9. No duplicate h1s
 * 10. Keyboard shortcut: back button fires router.back()
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

// ─── Dependency mocks ─────────────────────────────────────────────────────────

const { back } = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
}));

vi.mock("@/components/settings/AccountSettings", () => ({
  AccountSettings: () => (
    <section aria-label="Account settings">
      <button type="button">Update email</button>
      <button type="button">Change password</button>
    </section>
  ),
}));

vi.mock("@/components/settings/NotificationSettings", () => ({
  NotificationSettings: () => (
    <section aria-label="Notification settings">
      <button type="button">Save preferences</button>
    </section>
  ),
}));

vi.mock("@/components/settings/DangerZone", () => ({
  DangerZone: () => (
    <section aria-label="Danger zone">
      <button type="button">Delete account</button>
    </section>
  ),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

function getAllFocusables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function getDomIndex(el: HTMLElement): number {
  return getAllFocusables().indexOf(el);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Settings route — focus order (#1480)", () => {
  beforeEach(() => {
    back.mockReset();
  });

  // ── Landmarks ───────────────────────────────────────────────────────────────

  describe("Landmarks and ARIA", () => {
    it("has a <main> landmark labelled via aria-labelledby", () => {
      const { container } = render(<SettingsPage />);
      expect(
        container.querySelector('main[aria-labelledby="settings-page-title"]'),
      ).toBeInTheDocument();
    });

    it("h1 has id='settings-page-title' so aria-labelledby resolves", () => {
      render(<SettingsPage />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Settings" }),
      ).toHaveAttribute("id", "settings-page-title");
    });

    it("has exactly one h1 (no duplicate titles)", () => {
      render(<SettingsPage />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });

    it("status announcer has role=status, aria-live=polite, aria-atomic=true", () => {
      const { container } = render(<SettingsPage />);
      const announcer = container.querySelector("#settings-status-announcer");
      expect(announcer).toBeInTheDocument();
      expect(announcer).toHaveAttribute("role", "status");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveAttribute("aria-atomic", "true");
    });
  });

  // ── Skip link ────────────────────────────────────────────────────────────────

  describe("Skip link", () => {
    it("skip link targets #settings-page-content", () => {
      render(<SettingsPage />);
      expect(
        screen.getByRole("link", { name: "Skip to settings" }),
      ).toHaveAttribute("href", "#settings-page-content");
    });

    it("skip link is the FIRST focusable element on the page", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      const allFocusables = getAllFocusables();
      expect(allFocusables[0]).toBe(skipLink);
    });

    it("skip link has sr-only class by default (visually hidden when not focused)", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      expect(skipLink.className).toContain("sr-only");
    });

    it("skip link has focus:not-sr-only so it becomes visible on focus", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      expect(skipLink.className).toContain("focus:not-sr-only");
    });

    it("skip link has focus:ring-2 for visible focus indicator", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      expect(skipLink.className).toContain("focus:ring-2");
    });
  });

  // ── Focus order ──────────────────────────────────────────────────────────────

  describe("Focus order", () => {
    it("skip link comes before the back button in DOM order", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      const backBtn = screen.getByRole("button", { name: "Go back" });
      expect(getDomIndex(skipLink)).toBeLessThan(getDomIndex(backBtn));
    });

    it("back button comes before 'Update email' in DOM order", () => {
      render(<SettingsPage />);
      const backBtn = screen.getByRole("button", { name: "Go back" });
      const updateEmailBtn = screen.getByRole("button", { name: "Update email" });
      expect(getDomIndex(backBtn)).toBeLessThan(getDomIndex(updateEmailBtn));
    });

    it("skip link → back button → first settings control is the correct tab order", () => {
      render(<SettingsPage />);
      const skipLink = screen.getByRole("link", { name: "Skip to settings" });
      const backBtn = screen.getByRole("button", { name: "Go back" });
      const updateEmailBtn = screen.getByRole("button", { name: "Update email" });

      const skipIdx = getDomIndex(skipLink);
      const backIdx = getDomIndex(backBtn);
      const emailIdx = getDomIndex(updateEmailBtn);

      expect(skipIdx).toBeLessThan(backIdx);
      expect(backIdx).toBeLessThan(emailIdx);
    });

    it("settings controls appear in document order: email → password → save → delete", () => {
      render(<SettingsPage />);
      const updateEmail = screen.getByRole("button", { name: "Update email" });
      const changePassword = screen.getByRole("button", { name: "Change password" });
      const savePrefs = screen.getByRole("button", { name: "Save preferences" });
      const deleteAccount = screen.getByRole("button", { name: "Delete account" });

      expect(getDomIndex(updateEmail)).toBeLessThan(getDomIndex(changePassword));
      expect(getDomIndex(changePassword)).toBeLessThan(getDomIndex(savePrefs));
      expect(getDomIndex(savePrefs)).toBeLessThan(getDomIndex(deleteAccount));
    });
  });

  // ── Settings content region ──────────────────────────────────────────────────

  describe("Settings content region", () => {
    it("settings content region has id='settings-page-content' (skip link target)", () => {
      const { container } = render(<SettingsPage />);
      expect(
        container.querySelector("#settings-page-content"),
      ).toBeInTheDocument();
    });

    it("settings content region has tabIndex=-1 so skip link can focus it", () => {
      const { container } = render(<SettingsPage />);
      const region = container.querySelector("#settings-page-content");
      expect(region).toHaveAttribute("tabindex", "-1");
    });

    it("settings content region has aria-label='Settings options'", () => {
      const { container } = render(<SettingsPage />);
      expect(
        container.querySelector(
          '#settings-page-content[aria-label="Settings options"]',
        ),
      ).toBeInTheDocument();
    });

    it("settings content region applies focus-visible ring to descendant controls", () => {
      const { container } = render(<SettingsPage />);
      const region = container.querySelector("#settings-page-content");
      expect(region?.className).toContain("focus-visible");
      expect(region?.className).toContain("ring-2");
    });
  });

  // ── Back button ──────────────────────────────────────────────────────────────

  describe("Back button", () => {
    it("back button has aria-label='Go back'", () => {
      render(<SettingsPage />);
      expect(
        screen.getByRole("button", { name: "Go back" }),
      ).toBeInTheDocument();
    });

    it("clicking back button calls router.back()", async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      await user.click(screen.getByRole("button", { name: "Go back" }));
      expect(back).toHaveBeenCalledOnce();
    });

    it("keyboard activation (Enter) of back button calls router.back()", async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);
      const backBtn = screen.getByRole("button", { name: "Go back" });
      backBtn.focus();
      await user.keyboard("{Enter}");
      expect(back).toHaveBeenCalledOnce();
    });
  });

  // ── No regression on join-room ────────────────────────────────────────────────

  describe("No regression on co-located components", () => {
    it("JoinRoomForm is not rendered on the settings page (separate route)", () => {
      render(<SettingsPage />);
      // JoinRoomForm has a room-code textbox; it must not appear on settings
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("settings page does not have role=form landmark (should be plain sections)", () => {
      render(<SettingsPage />);
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
  });
});
