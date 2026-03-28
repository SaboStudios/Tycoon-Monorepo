# CORS Security Guide

## Overview

This guide documents the Cross-Origin Resource Sharing (CORS) security implementation for the Tycoon backend API. The implementation provides a secure, flexible, and environment-aware CORS configuration system.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Security Features](#security-features)
- [Development Wildcard Rules](#development-wildcard-rules)
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
  - Understand that credentials require specific origins (not wildcard)

- [ ] **Verify Wildcard Settings**
  - `CORS_DEV_WILDCARD=false` in production (or rely on NODE_ENV check)
  - No warning logs about wildcards in non-dev environments

- [ ] **Test Configuration**
  - Application starts without validation errors
  - Startup logs show correct origin count
  - No unexpected warnings in logs

### Post-Deployment

- [ ] **Monitor Logs**
  - Check for rejected origin warnings
  - Investigate any unexpected CORS rejections
  - Verify no legitimate origins are being blocked

- [ ] **Test Client Access**
  - Verify all legitimate clients can access API
  - Confirm credentials (cookies/auth) work correctly
  - Test preflight requests are cached

- [ ] **Security Audit**
  - Review CORS headers in browser DevTools
  - Verify `Access-Control-Allow-Origin` returns specific origin
  - Confirm `Access-Control-Allow-Credentials: true` when expected

### Regular Maintenance

- [ ] **Review Origin List**
  - Remove decommissioned domains
  - Add new legitimate origins
  - Update for domain changes

- [ ] **Check Logs Periodically**
  - Look for patterns in rejected origins
  - Identify potential security issues
  - Update allowlist as needed

## Manual Testing Procedure

### Prerequisites

- Backend server running
- Browser with DevTools (Chrome, Firefox, Edge)
- `curl` or Postman for API testing

### Test 1: Allowed Origin (Success)

**Objective:** Verify that configured origins are allowed.

**Steps:**
1. Configure an allowed origin:
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

2. Start the backend server

3. Create a test HTML file (`test-cors.html`):
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>CORS Test</h1>
     <button onclick="testCors()">Test API Call</button>
     <pre id="result"></pre>
     <script>
       async function testCors() {
         try {
           const response = await fetch('http://localhost:3000/api/v1/health', {
             method: 'GET',
             credentials: 'include',
             headers: {
               'Content-Type': 'application/json'
             }
           });
           const data = await response.json();
           document.getElementById('result').textContent = 
             'Success!\n' + JSON.stringify(data, null, 2);
         } catch (error) {
           document.getElementById('result').textContent = 
             'Error: ' + error.message;
         }
       }
     </script>
   </body>
   </html>
   ```

4. Serve the HTML file from `http://localhost:3000` (use `python -m http.server 3000` or similar)

5. Open the page and click "Test API Call"

**Expected Result:**
- ✅ Request succeeds
- ✅ Response data displayed
- ✅ No CORS errors in console
- ✅ DevTools Network tab shows:
  - `Access-Control-Allow-Origin: http://localhost:3000`
  - `Access-Control-Allow-Credentials: true`

### Test 2: Unauthorized Origin (Rejection)

**Objective:** Verify that non-configured origins are rejected.

**Steps:**
1. Use the same test HTML file from Test 1

2. Serve it from a different origin (e.g., `http://localhost:8080`)

3. Open the page and click "Test API Call"

4. Check backend logs for rejection message

**Expected Result:**
- ❌ Request fails with CORS error
- ❌ Console shows: "Access to fetch... has been blocked by CORS policy"
- ✅ Backend logs show: `CORS: Rejected origin: http://localhost:8080`
- ✅ No `Access-Control-Allow-Origin` header in response

### Test 3: Preflight Request (OPTIONS)

**Objective:** Verify preflight caching works correctly.

**Steps:**
1. Configure CORS:
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   CORS_MAX_AGE=3600
   ```

2. Use curl to send a preflight request:
   ```bash
   curl -X OPTIONS http://localhost:3000/api/v1/users \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v
   ```

**Expected Result:**
- ✅ Response status: 204 No Content
- ✅ Headers include:
  - `Access-Control-Allow-Origin: http://localhost:3000`
  - `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Accept, Authorization`
  - `Access-Control-Max-Age: 3600`
  - `Access-Control-Allow-Credentials: true`

### Test 4: Development Wildcard (localhost)

**Objective:** Verify development wildcard rules work.

**Steps:**
1. Configure for development:
   ```bash
   NODE_ENV=development
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   CORS_DEV_WILDCARD=true
   ```

2. Test from `http://localhost:5000` (not in allowlist)

3. Check if request succeeds due to wildcard rule

**Expected Result:**
- ✅ Request succeeds (wildcard rule applied)
- ✅ Backend logs show wildcard rules enabled at startup
- ✅ Response includes `Access-Control-Allow-Origin: http://localhost:5000`

### Test 5: Production Strict Mode

**Objective:** Verify wildcards are disabled in production.

**Steps:**
1. Configure for production:
   ```bash
   NODE_ENV=production
   CORS_ALLOWED_ORIGINS=https://app.example.com
   CORS_DEV_WILDCARD=true
   ```

2. Test from `http://localhost:3000`

**Expected Result:**
- ❌ Request fails (wildcard rules not applied in production)
- ✅ Backend logs show no wildcard rules enabled
- ✅ Origin rejected and logged

### Test 6: Credentials with Cookies

**Objective:** Verify credentials policy works with cookies.

**Steps:**
1. Configure CORS:
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   CORS_CREDENTIALS=true
   ```

2. Use fetch with credentials:
   ```javascript
   fetch('http://localhost:3000/api/v1/auth/login', {
     method: 'POST',
     credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ username: 'test', password: 'test' })
   });
   ```

**Expected Result:**
- ✅ Request succeeds
- ✅ Cookies are sent and received
- ✅ Response includes `Access-Control-Allow-Credentials: true`

### Test 7: Multiple Origins

**Objective:** Verify multiple origins in allowlist work correctly.

**Steps:**
1. Configure multiple origins:
   ```bash
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
   ```

2. Test from each origin separately

**Expected Result:**
- ✅ All three origins succeed
- ✅ Each response returns the specific requesting origin
- ✅ Startup logs show "3 allowed origin(s) configured"

## Troubleshooting

### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** Origin is not in allowlist and doesn't match wildcard rules.

**Solution:**
1. Check backend logs for rejection message
2. Add origin to `CORS_ALLOWED_ORIGINS`
3. Or enable dev wildcards if in development

### Issue: "Wildcard '*' cannot be used when credentials are enabled"

**Cause:** Attempting to use wildcard origin with credentials.

**Solution:**
- This implementation never uses wildcards, so this shouldn't occur
- If you see this, check for manual CORS configuration elsewhere

### Issue: Preflight requests failing

**Cause:** Missing or incorrect preflight headers.

**Solution:**
1. Verify `Access-Control-Request-Method` matches allowed methods
2. Check `Access-Control-Request-Headers` are in allowed list
3. Ensure origin is in allowlist

### Issue: Cookies not being sent

**Cause:** Credentials not enabled or origin mismatch.

**Solution:**
1. Set `CORS_CREDENTIALS=true`
2. Use `credentials: 'include'` in fetch requests
3. Verify origin exactly matches allowlist entry (including protocol and port)

### Issue: "Invalid CORS origins detected" at startup

**Cause:** One or more origins in `CORS_ALLOWED_ORIGINS` are not valid URLs.

**Solution:**
1. Check each origin has protocol (http:// or https://)
2. Verify no typos in domain names
3. Remove any trailing slashes or paths
4. Example: Use `https://app.example.com` not `app.example.com` or `https://app.example.com/`

### Issue: Development wildcards not working

**Cause:** Wildcards disabled or not in development mode.

**Solution:**
1. Verify `NODE_ENV=development`
2. Check `CORS_DEV_WILDCARD=true` (or not set)
3. Review startup logs for wildcard status
4. Ensure origin matches wildcard patterns (localhost, 127.0.0.1, *.local)

### Issue: Too many preflight requests

**Cause:** `CORS_MAX_AGE` too low or not set.

**Solution:**
1. Increase `CORS_MAX_AGE` (e.g., 86400 for 24 hours)
2. Verify header is present in OPTIONS responses
3. Check browser DevTools to confirm caching

## Best Practices

1. **Use HTTPS in Production**
   - Always use `https://` origins in production
   - Never use `http://` for production domains

2. **Minimize Origin List**
   - Only add origins that need API access
   - Remove decommissioned domains promptly

3. **Monitor Logs**
   - Regularly review rejected origin logs
   - Investigate unexpected rejections
   - Set up alerts for unusual patterns

4. **Test Before Deployment**
   - Verify CORS configuration in staging
   - Test all client applications
   - Confirm credentials work correctly

5. **Document Custom Origins**
   - Maintain a list of why each origin is allowed
   - Document which applications use each origin
   - Review periodically for accuracy

6. **Use Environment-Specific Configs**
   - Different origins for dev/staging/production
   - Never use production origins in development
   - Keep configurations in version control

7. **Disable Dev Wildcards in Production**
   - Set `CORS_DEV_WILDCARD=false` explicitly
   - Or rely on `NODE_ENV` check
   - Verify in startup logs

## Additional Resources

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP: CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [NestJS CORS Documentation](https://docs.nestjs.com/security/cors)

## Support

For issues or questions about CORS configuration:
1. Check this guide first
2. Review application logs
3. Test using the manual testing procedure
4. Contact the backend team with specific error messages and logs
