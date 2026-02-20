# Mobile AI Board – Improvement Ideas

## Quick wins (low effort)

### 1. **Remove dead code**
- **Commented-out blocks** (~50 lines): Game timer effect (lines ~187–201), turn timer effect (~725–766). Either implement or delete.
- **Unused state**: `gameTimeLeft`, `turnTimeLeft`, `endTime`, `durationMinutes` – only used in commented code. Remove if you’re not adding the timer feature.
- **Unused destructuring**: `endGameSuccess`, `endGameError`, `endGameTxHash` from `useEndAIGameAndClaim` – not used in UI. Remove or use (e.g. show tx link on success).
- **Unused variable**: `isCreatePending` from `useTransferPropertyOwnership` – consider using for a “Purchasing…” state on the Buy button.
- **Optional**: `isSpecialMove` / `isFollowingMyMove` – set but never read in the UI. Remove or use (e.g. “Special move” label).

### 2. **Delete or commit the copy file**
- `ai-board copy.tsx` is a duplicate and will drift. Prefer a single source of truth; use git history if you need the old version.

### 3. **Stabilize `justLandedProperty`**
- It’s derived from `landedPositionThisTurn.current` in `useMemo`, but refs don’t trigger re-renders. It works today because other state (e.g. `hasMovementFinished`) updates. Consider storing “landed position this turn” in state (e.g. `landedPositionThisTurn: number | null`) so `justLandedProperty` is clearly reactive.

---

## Refactor / structure

### 4. **Extract more hooks**
- **`useMobileGameSync`**: `currentGame`, `players`, `currentGameProperties`, `fetchUpdatedGame`, 8s poll, trade-toast effect. Keeps sync logic in one place.
- **`useMobileDiceAndTurn`**: Roll state, `ROLL_DICE`, `END_TURN`, `BUY_PROPERTY`, lock/unlock, turn-reset effect, board camera (scale/origin). Would shrink the main component further.
- **`useBuyPrompt`**: Buy-prompt effect + `buyPrompted` / `setBuyPrompted`. Small but keeps “when to show buy” in one hook.

### 5. **Group state with `useReducer` or a small state slice**
- Many related `useState` calls (roll, isRolling, actionLock, buyPrompted, etc.). A single `useReducer` for “turn phase” or a small context could simplify transitions and reduce prop drilling.

### 6. **Move rent logic to shared code**
- `getCurrentRent` is pure and could live in `@/utils/gameUtils` or `./utils/rent.ts` and be reused by desktop + mobile.

---

## UX / behavior

### 7. **Use loading state on Buy**
- While `transferOwnership` runs, disable the Buy button and show “Purchasing…” using `isCreatePending` (or a local loading state).

### 8. **Game / turn timers**
- If you want a visible game or per-turn timer, implement the commented timer logic and wire it to `gameTimeLeft` / `turnTimeLeft` (and possibly auto-end turn when turn time hits 0).

### 9. **Error handling**
- `console.error` / `console.warn` are fine for dev; consider surfacing critical errors (e.g. “Sync failed”, “Purchase failed”) as toasts or a small error banner so users get feedback.

---

## Performance

### 10. **Memoize heavy callbacks**
- `getCurrentRent` is recreated every render. Wrap in `useCallback` if it’s passed to many children or used in deps.
- **Board**: If `Board` re-renders a lot, memoize it with `React.memo` and ensure props (e.g. `animatedPositions`) are stable where possible.

### 11. **Polling**
- 8s polling is simple but can be heavy. Consider WebSockets for game updates or increasing the interval when the tab is hidden (e.g. `document.visibilityState`).

---

## Types / safety

### 12. **Stricter types**
- Replace `err: any` in `fetchUpdatedGame` with `unknown` and narrow (e.g. `err instanceof Error` or check for `response?.status`).
- Add a shared type for “roll” (e.g. `type Roll = { die1: number; die2: number; total: number }`) and use it in state and props.

### 13. **Prop types**
- Consider a single props type, e.g. `MobileGameLayoutProps`, in a `types.ts` next to the component (or in `@/types/game`) for reuse and clarity.

---

## Accessibility

### 14. **Labels and focus**
- Ensure “Roll Dice”, “Declare bankruptcy”, and modal actions have clear labels and focus order (especially in modals).
- Add `aria-live` for turn / balance changes if you have screen-reader users.

---

**Suggested order:** Do (1) and (2) first for a cleaner codebase, then (3) and (7) for correctness and UX. After that, pick refactors (4–6) or timers (8) based on what you’re building next.
