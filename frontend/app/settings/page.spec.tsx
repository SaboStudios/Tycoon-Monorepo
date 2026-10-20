import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SettingsPage from "./page";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Settings page danger-zone dialog (#1958)", () => {
  it("moves focus into the dialog on open and returns it to the trigger on Escape", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Reset progress" }));

    const trigger = screen.getByRole("button", { name: "Reset progress" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Focus lands on the first focusable element inside the dialog (Cancel).
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);

    // Escape closes the dialog and returns focus to the trigger.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps Tab from last to first and Shift+Tab from first to last", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Reset progress" }));

    const trigger = screen.getByRole("button", { name: "Reset progress" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Reset progress" });

    expect(document.activeElement).toBe(cancel);

    // Shift+Tab from the first wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    // Tab from the last wraps to the first.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
  });

  it("dialog exposes role=dialog, aria-modal and non-empty ARIA labels", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Reset progress" }));

    fireEvent.click(screen.getByRole("button", { name: "Reset progress" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    const describedBy = dialog.getAttribute("aria-describedby")!;
    expect(labelledBy.length).toBeGreaterThan(0);
    expect(describedBy.length).toBeGreaterThan(0);
  });

  it("does not call fetch until the confirm action is triggered", async () => {
    render(<SettingsPage />);
    await waitFor(() => screen.getByRole("button", { name: "Reset progress" }));

    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    const dialog = screen.getByRole("dialog");
    expect(fetchMock).not.toHaveBeenCalled();

    const confirm = within(dialog).getByRole("button", { name: "Reset progress" });
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/danger/reset-progress", expect.anything());
  });
});
