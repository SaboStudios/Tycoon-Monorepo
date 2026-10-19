# Join Room Flow - Implementation Guide

## Quick Start

### Running Tests

```bash
# Navigate to frontend directory
cd frontend

# Run all tests
pnpm test

# Run join room tests only
pnpm test JoinRoom

# Run with coverage
pnpm test --coverage

# Watch mode (re-run on file change)
pnpm test --watch
```

### Monitoring Metrics

```bash
# Check Web Vitals in production
# Metrics endpoint: GET /api/v1/metrics?route=/join-room
# Or POST metrics via useJoinRoomWebVitals hook

# Check error reports
# Error endpoint: POST /api/v1/errors
```

---

## Architecture Overview

### Component Hierarchy

```
app/join-room/page.tsx
├── page content wrapper
├── JoinRoomForm (Client Component)
│   ├── useJoinRoomTelemetry
│   ├── useErrorReporting
│   └── Form state management
│       ├── code (input value)
│       ├── errors (field & form errors)
│       ├── isLoading (submit state)
│       └── submitAttempts (retry tracking)
├── loading.tsx (Skeleton during hydration)
└── error.tsx (Route-level error boundary)
```

### Data Flow

```
User Types → handleChange
    ↓
sanitiseRoomCode() [alphanumeric, uppercase, 6-char]
    ↓
setCode() [update state]
    ↓
setErrors({}) [clear field errors]
    ↓
Button enabled if isValid
```

### Submission Flow

```
User Submits
    ↓
Rate Limit Check (2s cooldown)
    ↓
Client Validation (Zod schema)
    ├─ FAIL: trackJoinFailed('validation'), show field error
    └─ PASS: Continue
         ↓
    trackJoinAttempted('submit_button')
    setIsLoading(true)
         ↓
    POST /games/:code/join
         ├─ SUCCESS: trackJoinSucceeded(), navigate
         └─ ERROR: mapServerErrors(), trackJoinFailed(errorType)
                   reportError(err, context)
                   setIsLoading(false)
```

---

## Telemetry Integration

### Event Types

1. **Form Viewed**
   - Triggered on mount
   - Payload: `{ route, source }`
   - Source: `page_load` or `modal_open`

2. **Join Attempted**
   - Triggered before API call
   - Payload: `{ route, source }`
   - Source: `submit_button` or `keyboard_enter`

3. **Join Succeeded**
   - Triggered on 2xx response
   - Payload: `{ route }`
   - No sensitive data

4. **Join Failed**
   - Triggered on error or validation fail
   - Payload: `{ route, error_type }`
   - Error types: `validation`, `not_found`, `room_full`, `server_error`, `unknown`

### Privacy Sanitization

All payloads automatically pass through `sanitizeAnalyticsPayload()`:

```typescript
// Before sanitization
{
  route: '/join-room',
  source: 'submit_button',
  roomCode: 'TYCOON',  // ❌ BLOCKED
  userId: 123,         // ❌ BLOCKED
}

// After sanitization
{
  route: '/join-room',
  source: 'submit_button',
  // Sensitive fields removed
}
```

---

## Performance Optimization Checklist

### CLS Prevention

- [x] Skeleton dimensions match form dimensions
- [x] Error slot reserved with `min-h-[1.25rem]`
- [x] Button width reserved with `min-w-[4.5rem]`
- [x] No dynamic font loading
- [x] No image reflows
- [x] No ad injection

### LCP Optimization

- [x] Input focused on mount (ready for interaction)
- [x] No unnecessary API calls on load
- [x] Next.js dynamic imports used for non-critical components
- [x] Skeleton visible during hydration
- [x] CSS minimal and critical

### INP Optimization

- [x] Input sanitized synchronously (no debounce)
- [x] Form validation fast (Zod)
- [x] Submit button disabled during loading
- [x] Rate limiting prevents spam
- [x] Handlers memoized with useCallback

### Monitoring

```typescript
useJoinRoomWebVitals({
  debug: true,  // In development
  budgets: {
    lcp: 2500,   // milliseconds
    cls: 0.1,    // unitless
    inp: 200,    // milliseconds
  },
  reportingEndpoint: '/api/v1/metrics'
});
```

---

## Error Handling Pattern

### Error Mapping Strategy

```typescript
function mapServerErrors(error: unknown): FieldErrors {
  // 1. Check explicit field errors array
  if (Array.isArray(body.errors)) {
    return body.errors.reduce((acc, e) => ({
      ...acc,
      [e.field]: e.message
    }), {});
  }

  // 2. Check status code shortcuts
  if (body.statusCode === 404) return { _form: 'Room not found...' };
  if (body.statusCode === 409) return { _form: 'Room is full...' };
  if (body.statusCode >= 500) return { _form: 'Server error...' };

  // 3. Extract from message by keyword matching
  // ...

  return { _form: 'An unexpected error occurred' };
}
```

### Retry Logic

```
User sees error
    ↓
User clicks "Retry" button (if valid)
    ↓
Reset rate-limit timer: lastSubmitRef.current = 0
    ↓
requestSubmit() [programmatic form submission]
    ↓
Try join again immediately
```

---

## State Management Pattern

### No Redux/Global State

The form uses React local state + context for simplicity:

```typescript
const [code, setCode] = useState("");           // Input value
const [errors, setErrors] = useState({});       // Validation errors
const [isLoading, setIsLoading] = useState(false); // Loading state
const [submitAttempts, setSubmitAttempts] = useState(0); // Retry count
```

### State Transitions

```
Initial State
└─ code = ""
   errors = {}
   isLoading = false
   submitAttempts = 0

User Types Code
└─ code = "ABCDEF" (sanitized)
   errors = {} (cleared)

User Submits
├─ Validation Success
│  └─ isLoading = true
│     API call pending
│
├─ Validation Fail
│  └─ errors.roomCode = "Must be 6 characters"
│
├─ API Success
│  └─ Navigate to /game-waiting
│
└─ API Fail
   └─ errors._form = "Room not found"
      isLoading = false
      submitAttempts++
```

---

## Testing Best Practices

### Mock MSW Handlers

```typescript
// handlers.ts
const joinRoomHandlers = [
  // Specific handlers MUST come first
  http.post(`/api/v1/games/NOTFND/join`, () =>
    HttpResponse.json({ message: 'Not found' }, { status: 404 })
  ),
  
  // Generic handler MUST come last
  http.post(`/api/v1/games/:code/join`, () =>
    HttpResponse.json({ /* game data */ }, { status: 200 })
  ),
];
```

### Test Structure

```typescript
describe('JoinRoomForm', () => {
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server.listen();
    mockPush = vi.fn();
    (useRouter as any).mockReturnValue({ push: mockPush });
  });

  afterEach(() => server.close());

  describe('User Flow', () => {
    it('should...', async () => {
      render(<JoinRoomForm />);
      await userEvent.type(input, 'VALID');
      await userEvent.click(button);
      await waitFor(() => expect(mockPush).toHaveBeenCalled());
    });
  });
});
```

### Common Assertions

```typescript
// Element presence
expect(screen.getByTestId('form-error-banner')).toBeInTheDocument();

// Element state
expect(button).toBeDisabled();
expect(input).toHaveValue('ABCDEF');

// Async operations
await waitFor(() => expect(mockPush).toHaveBeenCalled());

// Accessibility
expect(input).toHaveAttribute('aria-invalid', 'true');
expect(button).toHaveAttribute('aria-busy', 'true');
```

---

## Accessibility Checklist

### Form Accessibility

- [x] Label associated with input via `htmlFor`
- [x] Input has `aria-required="true"`
- [x] Input has `aria-invalid={boolean}`
- [x] Input has `aria-describedby={errorId}`
- [x] Error message has unique id

### Button Accessibility

- [x] Button type clear (`type="submit"`)
- [x] Button has `aria-busy={isLoading}`
- [x] Button has `aria-disabled={disabled}`
- [x] Button label changes on state (Join → Joining…)

### Alert Accessibility

- [x] Error message has `role="alert"`
- [x] Alert appears dynamically (screen readers notified)
- [x] Icon has `aria-hidden="true"`

### Focus Management

- [x] Input focused on mount
- [x] Focus visible on keyboard navigation
- [x] Focus managed for screen readers

---

## Security Considerations

### Input Sanitization

```typescript
function sanitiseRoomCode(raw: string): string {
  // 1. Remove non-alphanumeric
  // 2. Convert to uppercase
  // 3. Cap at 6 characters
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
}
```

**Applied:** On every keystroke, preventing invalid chars from appearing

### API Security

```typescript
// URL encode room code to prevent injection
const url = `/games/${encodeURIComponent(result.data.roomCode)}/join`;

// Use apiClient with built-in security
await apiClient.post<GameResponse>(url, {});
```

### CORS & Auth

- Bearer token in Authorization header (via apiClient)
- Server validates token before processing
- CSRF protection via backend

### Rate Limiting

- Client-side: 2 second cooldown
- Server-side: Rate limit headers respected
- Prevents brute force attempts

---

## Debugging Tips

### Enable Debug Logging

```typescript
// In development
useJoinRoomWebVitals({ debug: true });

// Check console for:
// [Web Vitals] LCP 1500.23 good
// [Web Vitals] CLS 0.05 good
// [Error Report] {...}
```

### Inspect Network Requests

```typescript
// In DevTools Network tab
POST /api/v1/games/TYCOON/join
├─ Request: {}
└─ Response: { id, code, status, settings, players, ... }

POST /api/v1/metrics
├─ Request: { timestamp, route, metric: { name, value, rating } }
└─ Response: { ok: true }

POST /api/v1/errors
├─ Request: { timestamp, message, context, userAgent, url }
└─ Response: { ok: true }
```

### Test in Different Scenarios

```bash
# Simulate slow network
# DevTools → Network → Throttle to "Slow 3G"

# Simulate errors
# MSW: Change handler to return error status

# Simulate disconnected state
# DevTools → Network → Offline
```

---

## Common Issues & Solutions

### Issue: Tests failing with "Cannot find module"

**Solution:** Ensure MSW server is set up correctly

```typescript
const server = setupServer(...joinRoomHandlers);

beforeEach(() => server.listen());
afterEach(() => server.close());
```

### Issue: Form doesn't submit on keyboard Enter

**Solution:** Verify form element has `onSubmit` and button has `type="submit"`

```tsx
<form onSubmit={handleSubmit} noValidate>
  <input />
  <Button type="submit">Join</Button>
</form>
```

### Issue: Layout shifts when error appears

**Solution:** Reserve space with `min-h` even when empty

```tsx
<div className="min-h-[1.25rem]">
  {errors.roomCode && <span>{errors.roomCode}</span>}
</div>
```

### Issue: Telemetry not being sent

**Solution:** Check that `track()` is not mocked in tests

```typescript
// Don't mock in production tests
vi.unmock('@/lib/analytics');
```

---

## Performance Profiling

### Using React DevTools Profiler

1. Open React DevTools
2. Go to "Profiler" tab
3. Click "Record"
4. Interact with form
5. View render times and commits

**Target:** Form interactions should complete in < 16ms (60fps)

### Using Lighthouse

```bash
# Generate audit report
pnpm build
pnpm start  # local server
# Open Lighthouse in DevTools
```

**Target:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90

---

## Deployment Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] No console errors or warnings
- [ ] Lighthouse score > 90 (Performance)
- [ ] Web Vitals metrics collected
- [ ] Error reporting endpoint available
- [ ] Analytics backend ready
- [ ] CORS configured correctly
- [ ] Rate limiting enabled on backend
- [ ] Monitoring dashboard setup
- [ ] On-call team notified

---

## Rollback Plan

If issues arise in production:

1. **Disable telemetry:** Remove `useJoinRoomTelemetry` calls
2. **Disable metrics:** Disable `useJoinRoomWebVitals`
3. **Revert changes:** `git revert <commit>`
4. **Test locally:** Verify old version works
5. **Deploy:** Merge fix to main
6. **Verify:** Check metrics return to normal

---

## Monitoring & Alerts

### Key Metrics to Watch

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 5% | Alert on-call |
| LCP | > 3s | Performance investigation |
| CLS | > 0.15 | CLS analysis |
| Join Time | > 5s | Backend investigation |
| 404 Errors | > 20% | Invalid room codes? |
| 409 Errors | > 10% | Room full scenarios? |

### Dashboard Queries

```sql
-- Daily join attempts
SELECT COUNT(*) FROM analytics 
WHERE event = 'join_room_attempted' 
AND DATE(timestamp) = TODAY();

-- Success rate
SELECT 
  COUNT(CASE WHEN event = 'join_room_succeeded' THEN 1 END) * 100.0 / 
  COUNT(CASE WHEN event = 'join_room_attempted' THEN 1 END) as success_rate
FROM analytics;

-- Error breakdown
SELECT error_type, COUNT(*) 
FROM analytics 
WHERE event = 'join_room_failed'
GROUP BY error_type;

-- Median join time
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY duration) 
FROM metrics 
WHERE route = '/join-room';
```

---

## References

- [Web Vitals Documentation](https://web.dev/vitals/)
- [React Testing Library](https://testing-library.com/react)
- [Vitest](https://vitest.dev/)
- [MSW (Mock Service Worker)](https://mswjs.io/)
- [Zod Validation](https://zod.dev/)
- [Next.js Performance](https://nextjs.org/learn/foundations/how-nextjs-works/rendering)

---

## Support

For questions or issues:

1. Check test files in `frontend/src/**/__tests__/`
2. Review [JOIN_ROOM_IMPROVEMENTS.md](./JOIN_ROOM_IMPROVEMENTS.md)
3. File GitHub issue with error logs
4. Contact @frontend-team
