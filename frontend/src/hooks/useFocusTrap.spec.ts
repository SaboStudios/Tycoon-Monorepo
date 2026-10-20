import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useRef } from "react";
import { useFocusTrap } from "./useFocusTrap";

// jsdom does not pump requestAnimationFrame callbacks automatically, so drive
// them synchronously to make the trap's initial focus move deterministic.
const rafMock = vi.fn((cb: () => void) => {
  cb();
  return 0;
});
vi.stubGlobal("requestAnimationFrame", rafMock);
vi.stubGlobal("cancelAnimationFrame", vi.fn());

function Fixture({ active, onClose }: { active: boolean; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, active, onClose);
  return React.createElement("div", { ref: containerRef },
    React.createElement("button", { type: "button" }, "First"),
    React.createElement("button", { type: "button" }, "Second"),
    React.createElement("button", { type: "button" }, "Third"),
  );
}

describe("useFocusTrap (#2002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rafMock.mockClear();
  });

  it("moves focus into the trap container on mount", () => {
    const onClose = vi.fn();
    render(React.createElement(Fixture, { active: true, onClose }));
    const first = screen.getByRole("button", { name: "First" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Tab from the last focusable to the first", () => {
    const onClose = vi.fn();
    render(React.createElement(Fixture, { active: true, onClose }));
    const buttons = screen.getAllByRole("button");
    const first = buttons[0];
    const last = buttons[2];
    expect(document.activeElement).toBe(first);

    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    const onClose = vi.fn();
    render(React.createElement(Fixture, { active: true, onClose }));
    const buttons = screen.getAllByRole("button");
    const first = buttons[0];
    const last = buttons[2];

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("invokes the Escape callback exactly once", () => {
    const onClose = vi.fn();
    render(React.createElement(Fixture, { active: true, onClose }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element on unmount", () => {
    const onClose = vi.fn();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(React.createElement(Fixture, { active: true, onClose }));
    expect(document.activeElement).not.toBe(outside);

    unmount();
    expect(document.activeElement).toBe(outside);
  });
});

