# SW-FE-845 — Join Room Flow: Keyboard Shortcut Bindings

Part of the **Stellar Wave** engineering batch.

## Problem

The Join Room page had no keyboard shortcut support. Users navigating via keyboard had to Tab through the entire page to reach the room-code input and submit button. Common gaming conventions (e.g., `Enter` to submit, `Escape` to clear/close) were not wired.

| Shortcut | Issue |
|----------|-------|
| `Enter` | Already handled by form submit — no change needed |
| `Escape` | No handler to clear the input or close the form |
| `Ctrl+Enter` / `Cmd+Enter` | No handler to submit from anywhere in the form |

## Changes

| File | Change |
|------|--------|
| `src/components/settings/JoinRoomForm.tsx` | Added `useEffect` to listen for `Escape` key to clear the input and `Ctrl+Enter`/`Cmd+Enter` to submit from anywhere; added `aria-keyshortcuts` attribute to the form element. |
| `test/JoinRoomForm.e2e.test.tsx` | Added 4 new keyboard shortcut regression tests. |

### Component diff summary

```tsx
// Form element — added aria-keyshortcuts
<form aria-keyshortcuts="Escape Ctrl+Enter" ...>

// Escape handler — clears input and field errors
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && document.activeElement === inputRef.current) {
      setCode('');
      setErrors({});
      inputRef.current?.blur();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      formRef.current?.requestSubmit();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

## New tests

```
JoinRoomForm — keyboard shortcuts (SW-FE-845)
  ✓ Escape clears the input when focused
  ✓ Escape does not clear when input is not focused
  ✓ Ctrl+Enter submits the form
  ✓ Cmd+Enter submits the form (macOS)
```

## No new dependencies

Pure DOM event listener additions. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. Changes are additive keyboard handlers only — no visual change.

1. Deploy to preview.
2. Test manually:
   - Focus the room-code input, press Escape — input should clear
   - Type a valid code, press Ctrl+Enter — form should submit
   - Type a valid code, press Cmd+Enter (macOS) — form should submit
3. Promote to production once no regressions observed.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-845
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 4 new keyboard shortcut cases
- [x] No new production dependencies
- [x] Escape clears the input when focused
- [x] Ctrl+Enter submits the form
- [x] Cmd+Enter submits the form (macOS)
- [x] Form has `aria-keyshortcuts` attribute
