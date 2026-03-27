# Content Security Policy (CSP) Documentation

## Overview

This document outlines the Content Security Policy (CSP) implementation for the Tycoon frontend application. CSP is a security standard that helps prevent cross-site scripting (XSS), clickjacking, and other code injection attacks.

## CSP Strategy

### Development vs Production

- **Development**: CSP runs in report-only mode (`Content-Security-Policy-Report-Only`)
- **Production**: CSP is enforced (`Content-Security-Policy`)
- **Report-Only Mode**: Can be enabled via `CSP_REPORT_ONLY=true` environment variable

### Nonce Implementation

Nonces (Number Used Once) are used to allow specific inline scripts and styles while maintaining security:

1. **Generation**: Nonces are generated in the middleware (`src/middleware.ts`) using cryptographically secure random bytes
2. **Injection**: The nonce is passed via the `x-nonce` header to the layout
3. **Usage**: Apply the nonce to inline scripts and styles in the root layout

## CSP Directives

### Current Policy

```
default-src 'self'
script-src 'self' 'nonce-{nonce}'
style-src 'self' 'nonce-{nonce}'
img-src 'self' data: https:
font-src 'self' data:
connect-src 'self' https://api.example.com
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

### Directive Explanations

| Directive | Purpose | Value |
|-----------|---------|-------|
| `default-src` | Fallback for all content types | `'self'` - only same origin |
| `script-src` | Controls script execution | `'self'` + nonce for inline scripts |
| `style-src` | Controls stylesheet loading | `'self'` + nonce for inline styles |
| `img-src` | Controls image sources | Same origin, data URIs, HTTPS |
| `font-src` | Controls font sources | Same origin and data URIs |
| `connect-src` | Controls fetch/XHR/WebSocket | Same origin + API endpoints |
| `frame-ancestors` | Prevents clickjacking | `'none'` - cannot be framed |
| `base-uri` | Restricts base tag | `'self'` only |
| `form-action` | Restricts form submissions | `'self'` only |

## Third-Party Domains

### Allowed Domains

- **API**: `https://api.example.com` (update with actual API domain)
- **Analytics**: Add analytics domain to `connect-src` if needed
- **Wallet**: Add wallet provider domain to `connect-src` if needed

### Adding New Domains

To add a new third-party domain:

1. Update the `cspDirectives` array in `frontend/next.config.ts`
2. Add the domain to the appropriate directive (usually `connect-src`)
3. Test in report-only mode first
4. Monitor CSP violation reports

## Implementation Details

### Middleware (src/middleware.ts)

- Generates a new nonce for each request
- Passes nonce via `x-nonce` header
- Maintains existing authentication logic

### Configuration (next.config.ts)

- Defines CSP headers for all routes
- Supports report-only mode via environment variable
- Includes additional security headers

## Testing CSP

### Report-Only Mode

Enable report-only mode to test CSP without blocking content:

```bash
CSP_REPORT_ONLY=true npm run build
npm run start
```

### Monitoring Violations

1. Check browser console for CSP violation warnings
2. Monitor CSP violation reports (if configured)
3. Review Next.js server logs

## Security Review Checklist

- [ ] CSP headers configured in production
- [ ] Nonce generation implemented and tested
- [ ] Third-party domains documented and approved
- [ ] Report-only mode tested before enforcement
- [ ] Violation monitoring configured
- [ ] Team trained on CSP best practices
- [ ] Regular security audits scheduled

## Best Practices

1. **Minimize Inline Scripts**: Use external scripts when possible
2. **Use Nonces for Necessary Inline Code**: Only use nonces for required inline scripts
3. **Regular Audits**: Review CSP violations regularly
4. **Gradual Rollout**: Test in report-only mode before enforcement
5. **Document Changes**: Update this document when modifying CSP
6. **Monitor Third-Parties**: Keep track of all third-party domains

## Troubleshooting

### CSP Violations

If you see CSP violations:

1. Check the violation message in browser console
2. Identify the source (inline script, external domain, etc.)
3. Update CSP directives or add nonce as appropriate
4. Test in report-only mode first

### Inline Scripts Not Executing

- Ensure nonce is properly generated and passed
- Verify nonce is applied to script tag: `<script nonce={nonce}>`
- Check that nonce value matches in header and script tag

### Third-Party Services Blocked

- Add domain to appropriate CSP directive
- Test in report-only mode first
- Monitor for violations after enabling

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Content Security Policy](https://owasp.org/www-community/attacks/xss/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

## Environment Variables

```bash
# Enable report-only mode (development/testing)
CSP_REPORT_ONLY=true

# Production uses enforced CSP by default
NODE_ENV=production
```

## Support

For questions or issues related to CSP implementation, contact the security team or refer to the security documentation.
