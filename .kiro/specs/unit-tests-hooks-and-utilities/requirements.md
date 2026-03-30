# Requirements Document

## Introduction

This feature establishes a comprehensive unit test suite for the frontend's hooks and pure utility libraries (`src/hooks/` and `src/lib/`). The goal is to give the team fast, reliable feedback on currency formatting, timer logic, data-fetching hooks, validation schemas, error utilities, and the toast manager — all without relying on snapshot-only tests for logic. A shared Vitest configuration, optional MSW integration for fetch hooks, and a coverage threshold on `src/lib` will be enforced in CI.

## Glossary

- **Test_Runner**: The Vitest process that discovers and executes unit tests in the frontend workspace.
- **Coverage_Reporter**: The Vitest coverage provider (v8 or istanbul) that measures line/branch/function coverage.
- **MSW**: Mock Service Worker — the library used to intercept and mock HTTP requests in tests.
- **Hook**: A React custom hook located under `frontend/src/hooks/`.
- **Utility**: A pure TypeScript function or class located under `frontend/src/lib/`.
- **CI_Pipeline**: The GitHub Actions workflow that runs on every pull request and push to main.
- **Shared_Config**: The single `vitest.config.ts` file in `frontend/` that all unit tests inherit.
- **Coverage_Threshold**: The minimum acceptable coverage percentage for `src/lib` enforced by the Test_Runner.

---

## Requirements

### Requirement 1: Shared Vitest Configuration

**User Story:** As a developer, I want a single shared Vitest configuration, so that all unit tests run consistently with the same environment, aliases, and setup file.

#### Acceptance Criteria

1. THE Shared_Config SHALL set `environment` to `happy-dom` for all tests under `src/hooks/` and `src/lib/`.
2. THE Shared_Config SHALL resolve the `@/` path alias to `frontend/src/` so that imports in tests match production code.
3. THE Shared_Config SHALL reference `src/test/setup.ts` as the global setup file, which imports `@testing-library/jest-dom` matchers.
4. THE Shared_Config SHALL exclude `**/e2e/**` and `**/node_modules/**` from the test glob.
5. WHEN a developer adds a new test file matching `**/*.test.ts` or `**/*.test.tsx` under `src/`, THE Test_Runner SHALL discover and execute it without additional configuration.

---

### Requirement 2: Pure Utility Tests — `src/lib/utils`

**User Story:** As a developer, I want unit tests for `cn()` (class name merger), so that I can verify Tailwind class merging behaves correctly under all input combinations.

#### Acceptance Criteria

1. WHEN `cn()` is called with no arguments, THE Utility SHALL return an empty string.
2. WHEN `cn()` is called with a mix of strings, arrays, and objects, THE Utility SHALL return the correctly merged Tailwind class string.
3. WHEN `cn()` is called with conflicting Tailwind classes (e.g., `p-2` and `p-4`), THE Utility SHALL return only the last conflicting class.
4. THE Utility SHALL be idempotent: calling `cn(cn(x))` SHALL produce the same result as `cn(x)`.

---

### Requirement 3: Validation Schema Tests — `src/lib/validation/schemas`

**User Story:** As a developer, I want unit tests for all Zod validation schemas, so that I can confirm valid inputs pass and invalid inputs produce the correct error messages.

#### Acceptance Criteria

1. WHEN a valid email and non-empty password are provided to `loginSchema`, THE Utility SHALL parse successfully and return the typed object.
2. WHEN an invalid email is provided to `loginSchema`, THE Utility SHALL return a validation error referencing the email field.
3. WHEN a password shorter than 6 characters is provided to `adminLoginSchema`, THE Utility SHALL return a validation error referencing the password field.
4. WHEN a `roomCode` of exactly 6 alphanumeric characters is provided to `joinRoomSchema`, THE Utility SHALL parse successfully.
5. WHEN a `roomCode` containing special characters is provided to `joinRoomSchema`, THE Utility SHALL return a validation error.
6. WHEN a `roomCode` of fewer or more than 6 characters is provided to `joinRoomSchema`, THE Utility SHALL return a validation error.
7. WHEN a positive numeric string is provided as `customStake` to `gameSettingsSchema`, THE Utility SHALL parse successfully.
8. WHEN a non-numeric string is provided as `customStake` to `gameSettingsSchema`, THE Utility SHALL return a validation error.
9. FOR ALL schemas, parsing a valid object then re-parsing the output SHALL produce an equivalent object (round-trip property).

---

### Requirement 4: Error Utility Tests — `src/lib/errors/types`

**User Story:** As a developer, I want unit tests for error categorisation and sanitisation utilities, so that I can confirm errors are correctly classified and stripped of sensitive data.

#### Acceptance Criteria

1. WHEN `categorizeError` receives an `Error` with a message containing "network", THE Utility SHALL return `ErrorCategory.NETWORK`.
2. WHEN `categorizeError` receives an object with `status: 401`, THE Utility SHALL return `ErrorCategory.AUTH`.
3. WHEN `categorizeError` receives an object with `status: 404`, THE Utility SHALL return `ErrorCategory.NOT_FOUND`.
4. WHEN `categorizeError` receives an object with `status: 429`, THE Utility SHALL return `ErrorCategory.RATE_LIMIT`.
5. WHEN `categorizeError` receives an object with `status: 500`, THE Utility SHALL return `ErrorCategory.SERVER`.
6. WHEN `categorizeError` receives an unknown value, THE Utility SHALL return `ErrorCategory.UNKNOWN`.
7. WHEN `sanitizeError` is called with any error, THE Utility SHALL return a `SanitizedError` whose `userMessage` is a non-empty string.
8. WHEN `sanitizeError` is called with any error, THE Utility SHALL return a `SanitizedError` that does not contain tokens, passwords, or email addresses in any field.
9. WHEN `isNetworkError` is called with a network-type error, THE Utility SHALL return `true`.
10. WHEN `isRecoverableError` is called with a `NOT_FOUND` error, THE Utility SHALL return `false`.

---

### Requirement 5: API Error Tests — `src/lib/api/errors`

**User Story:** As a developer, I want unit tests for `TycoonApiError` and its helper functions, so that I can verify HTTP status codes map to the correct error codes and type guards work correctly.

#### Acceptance Criteria

1. WHEN `TycoonApiError` is constructed with `statusCode: 401` and `code: 'UNAUTHORIZED'`, THE Utility SHALL expose those values on the instance.
2. WHEN `isApiError` is called with a `TycoonApiError` instance, THE Utility SHALL return `true`.
3. WHEN `isApiError` is called with a plain `Error`, THE Utility SHALL return `false`.
4. WHEN `isValidationError` is called with a `TycoonApiError` whose code is `'VALIDATION_ERROR'`, THE Utility SHALL return `true`.
5. WHEN `isUnauthorized` is called with a `TycoonApiError` whose code is `'UNAUTHORIZED'`, THE Utility SHALL return `true`.
6. WHEN `parseErrorResponse` is called with a `Response` of status 404, THE Utility SHALL resolve to a `TycoonApiError` with `code: 'NOT_FOUND'`.
7. WHEN `parseErrorResponse` is called with a `Response` of status 500, THE Utility SHALL resolve to a `TycoonApiError` with `code: 'INTERNAL_SERVER_ERROR'`.
8. WHEN `parseErrorResponse` is called with a `Response` whose body is not valid JSON, THE Utility SHALL still resolve to a `TycoonApiError` using the HTTP status text as the message.

---

### Requirement 6: Toast Manager Tests — `src/lib/toast/toast-manager`

**User Story:** As a developer, I want unit tests for `ToastManager`, so that I can verify deduplication logic prevents the same toast from firing multiple times within the timeout window.

#### Acceptance Criteria

1. WHEN `toastManager.success` is called with a message, THE Utility SHALL invoke `toast.success` exactly once.
2. WHEN `toastManager.success` is called twice with the same message within 3 seconds, THE Utility SHALL invoke `toast.success` only once (deduplication).
3. WHEN `toastManager.success` is called twice with the same message after 3 seconds have elapsed, THE Utility SHALL invoke `toast.success` twice.
4. WHEN `toastManager.error` is called with a message, THE Utility SHALL invoke `toast.error` exactly once.
5. WHEN `toastManager.clear` is called, THE Utility SHALL invoke `toast.dismiss`.

---

### Requirement 7: NEAR Execution Utility Tests — `src/lib/near/execution`

**User Story:** As a developer, I want unit tests for NEAR transaction outcome helpers, so that I can confirm success/failure detection is correct for all outcome shapes.

#### Acceptance Criteria

1. WHEN `getTransactionHashFromOutcome` is called with an outcome containing a `transaction_outcome.id`, THE Utility SHALL return that id string.
2. WHEN `getTransactionHashFromOutcome` is called with an outcome where `transaction_outcome` is absent, THE Utility SHALL return an empty string.
3. WHEN `isFinalExecutionSuccess` is called with an outcome whose `status` is the string `"Failure"`, THE Utility SHALL return `false`.
4. WHEN `isFinalExecutionSuccess` is called with an outcome whose `status` is `{ Failure: null }`, THE Utility SHALL return `false`.
5. WHEN `isFinalExecutionSuccess` is called with an outcome whose `status` is `{ SuccessValue: "" }`, THE Utility SHALL return `true`.

---

### Requirement 8: `useCardModal` Hook Tests

**User Story:** As a developer, I want unit tests for `useCardModal`, so that I can verify modal open/close state transitions and card data management are correct.

#### Acceptance Criteria

1. WHEN `useCardModal` is first rendered, THE Hook SHALL return `isOpen: false` and `card: null`.
2. WHEN `openCard` is called with a `CardData` object, THE Hook SHALL set `isOpen` to `true` and `card` to the provided data.
3. WHEN `close` is called after `openCard`, THE Hook SHALL set `isOpen` to `false` and `card` to `null`.
4. WHEN `openCard` is called multiple times in sequence, THE Hook SHALL always reflect the most recently provided card data.
5. THE Hook SHALL be idempotent: calling `close` when already closed SHALL leave `isOpen` as `false` and `card` as `null`.

---

### Requirement 9: `useMediaQuery` Hook Tests

**User Story:** As a developer, I want unit tests for `useMediaQuery`, so that I can verify it returns the correct match state and responds to media query changes.

#### Acceptance Criteria

1. WHEN `useMediaQuery` is rendered in a server-side (no `window`) environment, THE Hook SHALL return the provided `defaultValue`.
2. WHEN `useMediaQuery` is rendered with a query that the mock `matchMedia` reports as matching, THE Hook SHALL return `true`.
3. WHEN `useMediaQuery` is rendered with a query that the mock `matchMedia` reports as not matching, THE Hook SHALL return `false`.
4. WHEN the `matchMedia` listener fires a change event with `matches: true`, THE Hook SHALL update its return value to `true`.
5. WHEN the component using `useMediaQuery` unmounts, THE Hook SHALL remove the `change` event listener from the `MediaQueryList`.

---

### Requirement 10: `useUnsavedChanges` Hook Tests

**User Story:** As a developer, I want unit tests for `useUnsavedChanges`, so that I can verify the `beforeunload` listener is attached and detached correctly and `confirmLeave` behaves as expected.

#### Acceptance Criteria

1. WHEN `useUnsavedChanges` is rendered with `isDirty: false`, THE Hook SHALL NOT attach a `beforeunload` listener to `window`.
2. WHEN `useUnsavedChanges` is rendered with `isDirty: true`, THE Hook SHALL attach a `beforeunload` listener to `window`.
3. WHEN `isDirty` transitions from `true` to `false`, THE Hook SHALL remove the `beforeunload` listener from `window`.
4. WHEN `confirmLeave` is called with `isDirty: false`, THE Hook SHALL return `true` without calling `window.confirm`.
5. WHEN `confirmLeave` is called with `isDirty: true` and the user confirms, THE Hook SHALL return `true`.
6. WHEN `confirmLeave` is called with `isDirty: true` and the user cancels, THE Hook SHALL return `false`.

---

### Requirement 11: MSW Integration for Fetch-Dependent Hooks

**User Story:** As a developer, I want optional MSW server setup for hooks that call the API client, so that I can test fetch-dependent behaviour without hitting real endpoints.

#### Acceptance Criteria

1. THE Test_Runner SHALL support MSW request interception via a shared `server` instance created with `setupServer` from `msw/node`.
2. WHEN a test file imports the shared MSW server, THE Test_Runner SHALL start the server before all tests and reset handlers after each test.
3. WHEN an MSW handler returns a 401 response for a protected endpoint, THE Hook under test SHALL surface a `TycoonApiError` with `code: 'UNAUTHORIZED'`.
4. IF no MSW handler is registered for a request, THEN THE Test_Runner SHALL warn and the request SHALL fail with a network error rather than silently succeeding.

---

### Requirement 12: Coverage Threshold for `src/lib`

**User Story:** As a developer, I want a coverage threshold enforced on `src/lib`, so that CI fails if utility coverage drops below the agreed minimum.

#### Acceptance Criteria

1. THE Coverage_Reporter SHALL measure line, branch, and function coverage for all files under `frontend/src/lib/`.
2. WHEN coverage for `frontend/src/lib/` falls below 80% lines, THE Test_Runner SHALL exit with a non-zero code.
3. WHEN coverage for `frontend/src/lib/` falls below 80% branches, THE Test_Runner SHALL exit with a non-zero code.
4. WHEN coverage for `frontend/src/lib/` falls below 80% functions, THE Test_Runner SHALL exit with a non-zero code.
5. THE Coverage_Reporter SHALL produce an output report (lcov or text) consumable by the CI_Pipeline.

---

### Requirement 13: CI Integration

**User Story:** As a developer, I want the unit test suite to run automatically in CI, so that every pull request is validated before merge.

#### Acceptance Criteria

1. THE CI_Pipeline SHALL execute `vitest run` (single-pass, no watch mode) for the frontend unit suite on every pull request.
2. WHEN all tests pass and coverage thresholds are met, THE CI_Pipeline SHALL report a passing status check.
3. IF any test fails or a coverage threshold is not met, THEN THE CI_Pipeline SHALL report a failing status check and block merge.
4. THE CI_Pipeline SHALL complete the unit test suite within 5 minutes on a standard GitHub Actions runner.
5. THE CI_Pipeline SHALL cache `node_modules` between runs to reduce install time.
