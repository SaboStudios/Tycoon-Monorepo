# SW-FE-033 — NEAR Wallet Accessibility: Focus Order

Status: Active
Owner: Frontend (Tycoon Monorepo)
Scope: NEAR wallet connect / sign-in UI only (ADR-003). Stellar is gated and out of scope.

## Problem

The NEAR wallet connect and sign-in surfaces do not expose a deterministic, keyboard-navigable focus order. Screen reader and keyboard-only players can lose focus when the wallet modal opens, when the NEAR wallet popup returns, and when the flow is rejected or errors. This breaks WCAG 2.1 AA (2.4.3 Focus Order, 2.4.7 Focus Visible, 3.2.1 On Focus) and blocks Stellar Wave contributions that depend on an accessible wallet entrypoint.

## Goals

- Deterministic focus order across the NEAR wallet connect → sign → success/reject lifecycle.
- Focus is trapped inside the wallet modal while open and restored to the invoking control on close.
- Visible focus indicators on every interactive element in the flow.
- Announce state changes (connecting, awaiting signature, rejected, error) via an ARIA live region.
- No JS-readable access tokens; auth uses httpOnly Secure SameSite cookies per ADR-004.

## Non-goals

- Stellar wallet UI (gated until readiness issue lands).
- Redesigning the wallet modal visuals.
- Backend auth/refresh/CSRF changes (tracked separately under AUTH_JWT_RUNBOOK and TOKEN_REFRESH_SECURITY_GUIDE).

## Focus order contract

1. Trigger control ("Connect NEAR wallet") receives focus on page load order; activating it opens the modal.
2. On modal open, focus moves to the modal heading (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
3. Tab order inside the modal follows DOM order: heading → wallet options → primary action → cancel/close.
4. Shift+Tab from the first focusable wraps to the last; Tab from the last wraps to the first (focus trap).
5. While the NEAR wallet popup is open, the modal shows a busy state and the primary action is disabled; focus stays on the status region.
6. On success, focus moves to the post-connect confirmation and the modal closes.
7. On reject or error, focus returns to the primary action and the error is announced.
8. On close (Escape, cancel, or success), focus is restored to the element that opened the modal.

## Implementation notes

- Use a single focus-trap utility shared by the wallet modal; do not hand-roll per-component traps.
- Store the previously focused element on open and restore it on unmount.
- Mark decorative icons `aria-hidden="true"`; give icon-only buttons an `aria-label`.
- Use `aria-live="polite"` for progress and `aria-live="assertive"` for errors.
- Never render access tokens into the DOM, localStorage, or sessionStorage; rely on httpOnly cookies.
- Ensure the modal is reachable and dismissible with keyboard only (Escape closes; focus returns).

## Edge cases

- User rejects the signature in the NEAR wallet popup → announce rejection, restore focus to primary action, keep modal open.
- Popup blocked or closed by the user → announce error, restore focus, allow retry.
- Replayed nonce / expired challenge → surface a retryable error without leaking server detail.
- Concurrent connect attempts → disable the trigger while a flow is in progress (idempotent).
- Auth expiry mid-flow → fail closed, return focus to the trigger, prompt re-connect.
- Reduced motion preference → no focus-stealing animations.

## Test plan

- RTL: wallet reject path restores focus to the primary action and announces the error.
- RTL: focus trap wraps forward and backward within the modal.
- RTL: focus is restored to the trigger on close.
- Keyboard-only manual pass: connect → sign → success and connect → reject.
- Screen reader pass (VoiceOver/NVDA): state changes announced, no focus loss.

## Acceptance criteria

- [ ] Deterministic focus order per the contract above.
- [ ] Focus trap active while modal is open; focus restored on close.
- [ ] Visible focus indicators on all interactive elements.
- [ ] State changes announced via ARIA live regions.
- [ ] No JS-readable access tokens; httpOnly Secure SameSite cookies only.
- [ ] RTL wallet reject path covered and green.

## References

- ADR-003 (NEAR-only chain UI until Stellar gated)
- ADR-004 (httpOnly Secure SameSite cookies)
- `backend/docs/AUTH_JWT_RUNBOOK.md`
- `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md`
- `frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md`
