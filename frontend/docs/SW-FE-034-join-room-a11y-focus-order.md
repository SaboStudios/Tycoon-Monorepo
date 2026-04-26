# SW-FE-034 — Join Room Flow: Accessibility & Focus Order

Part of the **Stellar Wave** engineering batch.

## Problem

The `JoinRoomForm` component had three accessibility gaps:

| Element | Issue |
|---------|-------|
| Room-code input | No focus on mount — keyboard users had to Tab to reach the only interactive field |
| Room-code input | Missing `aria-required` — AT did not announce the field as required |
| Submit button | Missing `aria-disabled` — AT announced the button as enabled even when the form was invalid; also lacked an explicit visible focus ring class |

## Changes

| File | Change |
|------|--------|
| `src/components/settings/JoinRoomForm.tsx` | `useRef` + `useEffect` to focus input on mount; `aria-required="true"` on input; `aria-disabled={!isValid \|\| isLoading}` + `focus-visible:ring-2` on submit button |
| `test/JoinRoomForm.e2e.test.tsx` | 4 new a11y regression tests (focus-on-mount, aria-required, aria-disabled invalid, aria-disabled valid) |

### Component diff summary

```tsx
// Focus on mount
const inputRef = React.useRef<HTMLInputElement>(null);
React.useEffect(() => { inputRef.current?.focus(); }, []);

// Input — added
<Input ref={inputRef} aria-required="true" ... />

// Button — added aria-disabled + focus ring
<Button aria-disabled={!isValid || isLoading}
        className="... focus-visible:ring-2 focus-visible:ring-[var(--tycoon-accent)] focus-visible:ring-offset-2"
>
```

## New tests

```
✓ focuses the room-code input on mount
✓ input has aria-required=true
✓ submit button has aria-disabled when form is invalid
✓ submit button aria-disabled is false when code is valid
```

## No new dependencies

Pure attribute and hook additions. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. Changes are additive ARIA attributes and a focus side-effect only.

1. Deploy to preview.
2. Test with VoiceOver (macOS) or NVDA (Windows):
   - Open the Join Room page — confirm focus lands on the input immediately.
   - Tab to the submit button with empty input — confirm AT announces it as disabled/dimmed.
   - Enter a valid 6-char code — confirm AT announces button as enabled.
3. Promote to production once no regressions observed.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-034
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 4 new a11y regression cases
- [x] No new production dependencies
- [x] Input receives focus on mount
- [x] Input is marked `aria-required`
- [x] Submit button reflects disabled state via `aria-disabled`
- [x] Submit button has explicit visible focus ring
