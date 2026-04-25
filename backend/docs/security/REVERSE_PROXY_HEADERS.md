# Security Headers — Reverse Proxy Split

## Problem: duplicate headers

When a reverse proxy (Nginx, Caddy, AWS ALB + WAF, Cloudflare) sits in front of
this NestJS service it may already inject security headers. If the application
also sets the same headers via Helmet you will see **duplicate values** in the
response, which can confuse browsers and fail securityheaders.io scans.

## Recommended split

| Header | Set by | Notes |
|---|---|---|
| `Strict-Transport-Security` | **Proxy** | Proxy terminates TLS; app never sees plain HTTP. Set `max-age=31536000; includeSubDomains; preload`. |
| `X-Content-Type-Options` | **App (Helmet)** | Always `nosniff`. |
| `X-Frame-Options` | **App (Helmet)** | `DENY` — API has no iframe use-case. |
| `Content-Security-Policy` | **App (Helmet)** | Tuned for JSON API + Swagger UI. |
| `Referrer-Policy` | **App (Helmet)** | `strict-origin-when-cross-origin`. |
| `Permissions-Policy` | **App (Helmet)** | Disables all browser features. |
| `Cross-Origin-Opener-Policy` | **App (Helmet)** | `same-origin`. |
| `Cross-Origin-Resource-Policy` | **App (Helmet)** | `same-origin`. |

## Nginx example (TLS termination at proxy)

```nginx
server {
    listen 443 ssl http2;

    # HSTS set here — disable in Helmet via HELMET_HSTS=false if needed
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

Set `app.trustProxy=true` in the app config so Express trusts the
`X-Forwarded-Proto` header and HSTS is applied correctly.

## Disabling Helmet HSTS when the proxy owns it

If your proxy already sets HSTS, set the environment variable:

```
HELMET_HSTS=false
```

Then guard the `hsts` option in `main.ts`:

```ts
hsts: process.env.HELMET_HSTS !== 'false' && {
  maxAge: 31_536_000,
  includeSubDomains: true,
  preload: true,
},
```

## securityheaders.io target grade

The configuration in `main.ts` is designed to achieve **grade A** on
[securityheaders.io](https://securityheaders.io). The only header that may
require proxy cooperation is `Strict-Transport-Security` (requires HTTPS).

Run the scan against your public URL after deployment:

```
https://securityheaders.io/?q=https%3A%2F%2Fyour-domain.com&followRedirects=on
```

Expected headers present: `Strict-Transport-Security`, `Content-Security-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`.
