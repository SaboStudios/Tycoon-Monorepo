"use client";

import { useEffect } from "react";

/**
 * Warns the user before closing the tab or navigating away when `isDirty` is true.
 * For in-app navigation, call `confirmLeave()` before router.push/back.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show their own message; setting returnValue triggers the dialog.
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function confirmLeave(): boolean {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Leave anyway?");
  }

  return { confirmLeave };
}
