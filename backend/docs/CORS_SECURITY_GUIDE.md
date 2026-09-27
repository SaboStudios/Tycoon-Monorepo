# CORS Security Guide

## Overview

This guide documents the Cross-Origin Resource Sharing (CORS) security implementation for the Tycoon backend API. The implementation provides a secure, flexible, and environment-aware CORS configuration system.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Security Features](#security-features)
- [Development Wildcard Rules](#development-wildcard-rules)
- [Cookie & CSRF Policy](#cookie--csrf-policy)
- [Security Checklist](#security-checklist)
- [Manual Testing Procedure](#manual-testing-procedure)
- [Troubleshooting](#troubleshooting)

## Environment Variables

### CORS_ALLOWED_ORIGINS

**Type:** String (comma-separated list)  
**Required:** Yes (in production)  
**Default:** `http://localhost:3000`

Comma-separated list of allowed origin URLs. Each origin must be a complete URL including protocol and domain.

**Examples:**
```bash
# Single origin
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Multiple origins
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://app.example.com

# Production configuration
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://mobile.example.com
```

**Validation:**
- Each origin must be a valid URL with protocol and host
- Whitespace is automatically trimmed
- Empty origins are filtered out
- At least one origin is required in production

### CORS_CREDENTIALS

**Type:** Boolean  
**Required:** No  
**Default:** `true`

Enable credentials support (cookies, authorization headers, TLS client certificates).

**Examples:**
```bash
# Enable credentials (default)
CORS_CREDENTIALS=true

# Disable credentials
CORS_CREDENTIALS=false
```

**Important:** When credentials are enabled, the server returns the specific requesting origin in the `Access-Control-Allow-Origin` header, not a wildcard (`*`). This is a security requirement of the CORS specification.

### CORS_MAX_AGE

**Type:** Integer (seconds)  
**Required:** No  
**Default:** `86400` (24 hours)

Duration in seconds that browsers should cache the preflight response (`Access-Control-Max-Age` header).

**Examples:**
```bash
# 24 hours (default)
CORS_MAX_AGE=86400

# 1 hour
CORS_MAX_AGE=3600

# 7 days
CORS_MAX_AGE=604800
```

**Benefits:**
- Reduces preflight OPTIONS requests
- Improves client performance
- Decreases server load

**Validation:**
- Must be a positive integer
- Recommended: 3600-86400 seconds (1-24 hours)

### CORS_DEV_WILDCARD

**Type:** Boolean  
**Required:** No  
**Default:** `true`

Enable development wildcard rules when `NODE_ENV=development`.

**Examples:**
```bash
# Enable dev wildcards (default)
CORS_DEV_WILDCARD=true

# Disable dev wildcards (strict allowlist only)
CORS_DEV_WILDCARD=false
```

**Wildcard Rules (when enabled in development):**
- `localhost` (any port) - e.g., `http://localhost:3000`, `http://localhost:8080`
- `127.0.0.1` (any port) - e.g., `http://127.0.0.1:3000`
- `*.local` domains - e.g., `http://myapp.local`, `https://dev.local:3000`

**Security Note:** Wildcard rules are automatically disabled in production regardless of this setting.

### CORS_ORIGIN (Legacy)

**Type:** String  
**Required:** No  
**Default:** `http://localhost:3000`  
**Status:** Deprecated (use `CORS_ALLOWED_ORIGINS` instead)

Single origin URL for backward compatibility. If `CORS_ALLOWED_ORIGINS` is not set, this value will be used.

**Example:**
```bash
CORS_ORIGIN=http://localhost:3000
```

## Configuration Examples

### Development Environment

```bash
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true
CORS_MAX_AGE=3600
CORS_DEV_WILDCARD=true
```

**Behavior:**
- Allows configured origins
- Allows all localhost/127.0.0.1 origins (any port)
- Allows *.local domains
- Credentials enabled
- 1-hour preflight cache

### Staging Environment

```bash
NODE_ENV=staging
CORS_ALLOWED_ORIGINS=https://staging.example.com,https://staging-admin.example.com
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
CORS_DEV_WILDCARD=false
```

**Behavior:**
- Strict allowlist enforcement
- Only configured origins allowed
- No wildcard rules
- Credentials enabled
- 24-hour preflight cache

### Production Environment

```bash
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
CORS_DEV_WILDCARD=false
```

**Behavior:**
- Strict allowlist enforcement
- Only configured origins allowed
- No wildcard rules (enforced)
- Credentials enabled
- 24-hour preflight cache
- Startup validation requires at least one origin

### Multiple Frontend Deployments

```bash
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://app.example.com,https://app-eu.example.com,https://app-asia.example.com,https://admin.example.com
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400
```

## Security Features

### 1. Environment-Based Allowlist

- **Explicit Configuration:** All allowed origins must be explicitly configured
- **No Wildcards in Production:** Wildcard origins (`*`) are never used
- **Validation at Startup:** Invalid origins cause application startup failure
- **Specific Origin Response:** Returns the specific requesting origin, not `*`

### 2. Development Wildcard Rules

- **Automatic Local Development:** Simplifies local development workflow
- **Environment-Aware:** Only active when `NODE_ENV=development`
- **Configurable:** Can be disabled with `CORS_DEV_WILDCARD=false`
- **Logged:** Wildcard status logged at startup

### 3. Dynamic Origin Validation

- **Runtime Validation:** Each request's origin is validated dynamically
- **Allowlist Check:** Exact match against configured origins
- **Wildcard Rules:** Applied only in development (if enabled)
- **Rejection Logging:** Rejected origins logged at WARN level

### 4. Credentials Policy

- **Secure by Default:** Credentials enabled by default
- **Configurable:** Can be disabled if not needed
- **Spec Compliant:** Never returns wildcard with credentials
- **Cookie Support:** Enables secure cookie-based authentication

### 5. Preflight Caching

- **Performance Optimization:** Reduces OPTIONS requests
- **Configurable Duration:** Adjustable cache time
- **Browser Compliance:** Uses standard `Access-Control-Max-Age` header

### 6. Comprehensive Logging

- **Startup Logging:** Configuration summary at application start
- **Rejection Logging:** Unauthorized origins logged with context
- **Warning Alerts:** Misconfigurations logged as warnings
- **Audit Trail:** All CORS decisions are logged

## Development Wildcard Rules

### When Active

Development wildcard rules are active when **all** of the following are true:
1. `NODE_ENV=development`
2. `CORS_DEV_WILDCARD=true` (or not set, as true is default)

### Allowed Patterns

| Pattern | Examples | Description |
|---------|----------|-------------|
| `localhost` | `http://localhost:3000`<br>`https://localhost:8080` | Any port on localhost |
| `127.0.0.1` | `http://127.0.0.1:3000`<br>`https://127.0.0.1:8080` | Any port on loopback IP |
| `*.local` | `http://myapp.local`<br>`https://dev.local:3000` | Any .local domain |

### Disabling Wildcards

To enforce strict allowlist even in development:

```bash
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:3000
CORS_DEV_WILDCARD=false
```

This is useful for:
- Testing production-like CORS behavior
- Debugging CORS issues
- Security audits

## Cookie & CSRF Policy

Per ADR-004, session authentication uses **httpOnly, Secure, SameSite cookies** and never JS-readable access tokens. CORS and cookie policy must be configured together so that cookie-authenticated mutations are protected against CSRF.

### Cookie Attributes

| Attribute | Value | Rationale |
|-----------|-------|-----------|
| `HttpOnly` | `true` | Prevents JavaScript (and XSS) from reading the session token |
| `Secure` | `true` (production/staging) | Cookie only sent over HTTPS |
| `SameSite` | `Lax` (default) or `Strict` | Blocks cross-site cookie attachment on mutations |
| `Path` | `/` | Scoped to the API surface |
| `Domain` | unset (host-only) | Avoids leaking cookies to sibling subdomains |

**Ban:** Do not store access/refresh tokens in `localStorage`, `sessionStorage`, or any JS-readable cookie. Any client code that reads a token from JS is a defect.

### Credentials + Origin Coupling

- `CORS_CREDENTIALS=true` is required for cookie auth; the server must echo the exact requesting origin (never `*`).
- Because credentials are enabled, the origin allowlist is the first line of defense: only allowlisted origins may send cookies.
- `SameSite=Lax`/`Strict` is the second line of defense; it prevents the browser from attaching the session cookie to cross-site requests.

### CSRF Strategy for Cookie-Authenticated Mutations

Cookie auth means the browser auto-attaches credentials, so state-changing requests need an explicit CSRF defense:

1. **Double-submit CSRF token**
   - On session establishment, issue a non-httpOnly `csrf_token` cookie (or return it in the login response body).
   - The client must echo it in the `X-CSRF-Token` header on every `POST`/`PUT`/`PATCH`/`DELETE`.
   - The server compares the header value to the cookie value (constant-time) and rejects mismatches with `403`.

2. **Origin/Referer check**
   - For cookie-authenticated mutations, verify the `Origin` header is in `CORS_ALLOWED_ORIGINS`.
   - Reject requests with a missing or non-allowlisted `Origin` on unsafe methods.

3. **Safe methods**
   - `GET`/`HEAD`/`OPTIONS` must be side-effect free and must not mutate state.

4. **Fail closed**
   - If CSRF validation cannot be performed (missing token, missing origin), reject the request rather than allowing it.

### returnTo Redirect Allowlist

Any `returnTo`/`redirect` parameter used after login must be validated against an allowlist to prevent open redirects:

- Accept only **relative paths** (e.g. `/dashboard`) or origins present in `CORS_ALLOWED_ORIGINS`.
- Reject absolute URLs to unknown hosts, protocol-relative URLs (`//evil.com`), and values containing control characters.
- Default to a safe internal path when validation fails.

### WebSocket Handshake

WS handshakes must parse the same session cookie as REST. Do not accept tokens via query string or `Sec-WebSocket-Protocol`; validate the cookie during the upgrade and reject unauthenticated upgrades.

## Security Checklist

Use this checklist to ensure your CORS configuration is secure:

### Pre-Deployment

- [ ] **Review Allowed Origins**
  - All origins in `CORS_ALLOWED_ORIGINS` are legitimate
  - No test/development origins in production config
  - Origins use HTTPS in production (not HTTP)

- [ ] **Validate Environment Variables**
  - `NODE_ENV` is set correctly for each environment
  - `CORS_ALLOWED_ORIGINS` contains only production domains
  - No wildcard (`*`) in origin list

- [ ] **Check Credentials Policy**
  - `CORS_CREDENTIALS=true` if using cookies or auth headers
  - Understand that credentials require an explicit origin (no `*`)

- [ ] **Verify Cookie Attributes**
  - Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`/`Strict`
  - No access/refresh tokens are readable from JavaScript

- [ ] **Verify CSRF Protection**
  - Cookie-authenticated mutations require a CSRF token and/or allowlisted `Origin`
  - CSRF failures return `403` and fail closed

- [ ] **Verify Redirect Allowlist**
  - `returnTo`/`redirect` values are restricted to relative paths or allowlisted origins

## Manual Testing Procedure

1. **Preflight request**
   ```bash
   curl -i -X OPTIONS https://api.example.com/auth/session \
     -H "Origin: https://app.example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type,x-csrf-token"
   ```
   Expect `Access-Control-Allow-Origin: https://app.example.com` and `Access-Control-Allow-Credentials: true`.

2. **Rejected origin**
   ```bash
   curl -i -X OPTIONS https://api.example.com/auth/session \
     -H "Origin: https://evil.example.com" \
     -H "Access-Control-Request-Method: POST"
   ```
   Expect no `Access-Control-Allow-Origin` for the rejected origin.

3. **CSRF rejection**
   ```bash
   curl -i -X POST https://api.example.com/shop/purchase \
     -H "Origin: https://app.example.com" \
     --cookie "session=..."
   ```
   Expect `403` when the `X-CSRF-Token` header is missing or mismatched.

4. **Open redirect rejection**
   ```bash
   curl -i "https://api.example.com/auth/login?returnTo=https://evil.example.com"
   ```
   Expect the redirect to fall back to a safe internal path.

## Troubleshooting

### Cookies Not Sent

- Confirm `CORS_CREDENTIALS=true` and that the client uses `credentials: 'include'`.
- Confirm the cookie is `Secure` and the request is over HTTPS.
- Confirm `SameSite` is not blocking the request (cross-site flows need `SameSite=None; Secure`).

### CSRF 403 on Valid Requests

- Confirm the client echoes the `csrf_token` cookie in `X-CSRF-Token`.
- Confirm the `Origin` header matches an entry in `CORS_ALLOWED_ORIGINS`.
- Confirm the CSRF cookie is not expired or cleared by the browser.

### Preflight Fails

- Confirm the requested method/headers are allowed.
- Confirm the origin is in the allowlist (or dev wildcard is enabled in development).
- Check server logs for rejected-origin warnings.
