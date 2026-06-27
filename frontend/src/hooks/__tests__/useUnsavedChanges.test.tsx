import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useUnsavedChanges } from "../useUnsavedChanges";

describe("useUnsavedChanges", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
    confirmSpy = vi.spyOn(window, "confirm");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── beforeunload listener lifecycle ──────────────────────────────────────

  it("does not attach a beforeunload listener when isDirty is false", () => {
    renderHook(() => useUnsavedChanges(false));
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("attaches a beforeunload listener when isDirty is true", () => {
    renderHook(() => useUnsavedChanges(true));
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes the listener on unmount when isDirty is true", () => {
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("does not attach a listener on unmount when isDirty is false", () => {
    const { unmount } = renderHook(() => useUnsavedChanges(false));
    unmount();
    // removeEventListener should never have been called for beforeunload
    const removedBeforeunload = removeSpy.mock.calls.some(
      ([event]) => event === "beforeunload",
    );
    expect(removedBeforeunload).toBe(false);
  });

  it("attaches listener when isDirty flips from false to true", () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: false },
    });
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    rerender({ dirty: true });
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes listener when isDirty flips from true to false", () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });
    addSpy.mockClear();
    removeSpy.mockClear();

    rerender({ dirty: false });
    // The cleanup from the previous effect fires — listener should be removed
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  // ── beforeunload handler behaviour ───────────────────────────────────────

  it("handler calls preventDefault and sets returnValue on the event", () => {
    renderHook(() => useUnsavedChanges(true));

    const [[, handler]] = addSpy.mock.calls.filter(([e]) => e === "beforeunload");
    const fakeEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as unknown,
    } as unknown as BeforeUnloadEvent;

    act(() => {
      (handler as EventListener)(fakeEvent as unknown as Event);
    });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(fakeEvent.returnValue).toBe("");
  });

  // ── confirmLeave ─────────────────────────────────────────────────────────

  it("confirmLeave returns true immediately when isDirty is false (no dialog)", () => {
    const { result } = renderHook(() => useUnsavedChanges(false));
    let returnValue: boolean | undefined;

    act(() => {
      returnValue = result.current.confirmLeave();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(returnValue).toBe(true);
  });

  it("confirmLeave returns true when user confirms the dialog", () => {
    confirmSpy.mockReturnValue(true);
    const { result } = renderHook(() => useUnsavedChanges(true));
    let returnValue: boolean | undefined;

    act(() => {
      returnValue = result.current.confirmLeave();
    });

    expect(confirmSpy).toHaveBeenCalledWith("You have unsaved changes. Leave anyway?");
    expect(returnValue).toBe(true);
  });

  it("confirmLeave returns false when user cancels the dialog", () => {
    confirmSpy.mockReturnValue(false);
    const { result } = renderHook(() => useUnsavedChanges(true));
    let returnValue: boolean | undefined;

    act(() => {
      returnValue = result.current.confirmLeave();
    });

    expect(confirmSpy).toHaveBeenCalledWith("You have unsaved changes. Leave anyway?");
    expect(returnValue).toBe(false);
  });

  // ── edge cases ───────────────────────────────────────────────────────────

  it("confirmLeave respects the latest isDirty value after re-render", () => {
    confirmSpy.mockReturnValue(true);
    const { result, rerender } = renderHook(
      ({ dirty }) => useUnsavedChanges(dirty),
      { initialProps: { dirty: true } },
    );

    // flip to clean — confirmLeave should now skip the dialog
    rerender({ dirty: false });

    let returnValue: boolean | undefined;
    act(() => {
      returnValue = result.current.confirmLeave();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(returnValue).toBe(true);
  });

  it("does not register duplicate listeners across re-renders with the same isDirty value", () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });

    const countBefore = addSpy.mock.calls.filter(([e]) => e === "beforeunload").length;

    rerender({ dirty: true });
    rerender({ dirty: true });

    const countAfter = addSpy.mock.calls.filter(([e]) => e === "beforeunload").length;

    // React's useEffect with stable deps should not re-add the listener
    expect(countAfter).toBe(countBefore);
  });

  it("hook always returns a confirmLeave function regardless of isDirty", () => {
    const { result: cleanResult } = renderHook(() => useUnsavedChanges(false));
    const { result: dirtyResult } = renderHook(() => useUnsavedChanges(true));

    expect(typeof cleanResult.current.confirmLeave).toBe("function");
    expect(typeof dirtyResult.current.confirmLeave).toBe("function");
  });
});
