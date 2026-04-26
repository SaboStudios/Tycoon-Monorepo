# SW-FE-037 — Join Room Flow: Error & Empty States

Part of the **Stellar Wave** engineering batch.

## Problem

Four gaps in the join-room error and empty-state handling:

### 1. No form-level error banner

`errors._form` (server/network errors) was passed as `error` to `FormField`,
rendering it inline below the input with `aria-describedby` pointing to it.
This is semantically wrong — a "Room not found" error is not a field validation
error. It was also silently cleared on the next keystroke, giving users no
recovery path if they hadn't changed the code.

### 2. No actionable status-code messages

`mapServerErrors` returned `"An unexpected error occurred"` for every error
that didn't match a field keyword — including 404 (room not found), 409 (room
full), and 5xx (server error). Users had no way to know what went wrong or what
to do next.

### 3. No retry affordance

After a server error the only recovery was to re-type the code and resubmit.
There was no "Retry" button, and the error was cleared on the next keystroke
even if the code was unchanged.

### 4. No route-level error boundary

Every other form route (`game-settings`, `game-play`) has an `error.tsx`
segment. `join-room` had none — a render error inside `JoinRoomForm` fell
through to the global 500 page with no contextual recovery.

## Changes

| File | Change |
|------|--------|
| `src/lib/validation/serverErrorMap.ts` | Added status-code shortcut before keyword extraction: `404` → "Room not found. Check the code and try again.", `409` → "Room is full. Try a different room.", `≥500` → "Server error. Please try again in a moment." |
| `src/components/settings/JoinRoomForm.tsx` | Added `_form` error banner (distinct from `FormField` error) with `role="alert"`, `data-testid="form-error-banner"`, and a "Retry" button that calls `formRef.current?.requestSubmit()` without clearing the code. `handleChange` now only drops `roomCode` from errors (not `_form`). `FormField` now receives only `errors.roomCode`. |
| `src/app/join-room/error.tsx` | New file. Route-level error boundary using `ErrorDisplay` — matches the `game-settings/error.tsx` pattern. |
| `test/JoinRoomForm.e2e.test.tsx` | 6 new error/empty-state tests + 3 new `mapServerErrors` status-code tests. |

### Diff summary

```tsx
// serverErrorMap.ts — status-code shortcuts
if (body.statusCode === 404) return { _form: "Room not found. Check the code and try again." };
if (body.statusCode === 409) return { _form: "Room is full. Try a different room." };
if (typeof body.statusCode === "number" && body.statusCode >= 500)
  return { _form: "Server error. Please try again in a moment." };

// JoinRoomForm.tsx — form-level banner
{errors._form && (
  <div role="alert" data-testid="form-error-banner" ...>
    <AlertCircle aria-hidden="true" />
    <span>{errors._form}</span>
    {isValid && (
      <button type="button" onClick={handleRetry} aria-label="Retry joining the room">
        <RefreshCw aria-hidden="true" /> Retry
      </button>
    )}
  </div>
)}

// handleChange — only clears field error, not _form
setErrors(({ roomCode: _dropped, ...rest }) => rest as FieldErrors);

// handleRetry — resubmits without clearing code
const handleRetry = useCallback(() => {
  setErrors({});
  formRef.current?.requestSubmit();
}, []);
```

## New tests

```
JoinRoomForm error and empty states (SW-FE-037)
  ✓ no form-level banner on initial render
  ✓ shows form-level banner with _form error message (404)
  ✓ shows room-full message for 409
  ✓ shows retry button inside banner when code is valid
  ✓ _form error persists when user edits the input
  ✓ banner is dismissed after retry clears errors

mapServerErrors (additions)
  ✓ maps 404 statusCode to room-not-found message
  ✓ maps 409 statusCode to room-full message
  ✓ maps 500 statusCode to server-error message
```

## No new dependencies

`AlertCircle` and `RefreshCw` are already in `lucide-react` (existing dep).
No new packages, no bundle budget exemption required.

## Feature flag / rollout

No runtime flag needed. All changes are additive UI and logic.

1. Deploy to preview.
2. Simulate a 404 response — confirm banner reads "Room not found. Check the
   code and try again." with a Retry button.
3. Simulate a 409 response — confirm banner reads "Room is full."
4. Click Retry — confirm the form resubmits without clearing the code.
5. Edit the input after a 404 — confirm the banner persists.
6. Trigger a render error inside the route — confirm `error.tsx` catches it
   with a contextual recovery UI (not the global 500 page).

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-037
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 9 new regression cases
- [x] No new production dependencies
- [x] `_form` errors render in a distinct banner, not inline with the field
- [x] 404 / 409 / 5xx produce actionable user messages
- [x] Retry button resubmits without clearing the room code
- [x] `_form` error persists across input edits
- [x] `join-room/error.tsx` catches render errors with contextual recovery UI
