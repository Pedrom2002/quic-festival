# Security policy

## Reporting a vulnerability

Email **ola@quic.pt** with subject `SECURITY: <short title>`.

Please include: affected endpoint or file, steps to reproduce, impact, and (if applicable) a minimal PoC. We will acknowledge within 72 hours.

Do not open public GitHub issues for security reports.

## Scope

In scope:
- `src/app/api/**`
- `src/middleware.ts`
- `src/lib/supabase/**`
- `supabase/migrations/**`
- Anything that handles guest PII or admin auth.

Out of scope:
- DoS via volumetric attacks (rate-limit is best-effort).
- Self-XSS / social engineering.
- Issues that require a compromised host to exploit.

## Hardening already in place

See `README.md` § Segurança for the full list. Highlights: CSP nonce + strict-dynamic, CSRF via `Sec-Fetch-Site` + `Origin` allowlist, RLS deny-by-default on `guests`/`admins`/`audit_log`, audit_log immutability trigger, rate-limit (Upstash + LRU fallback), captcha (Turnstile, fail-closed in production), formula-injection guard on CSV export, RFC 5545 escape on ICS, open-redirect allowlist on `/auth/callback`.

## Key rotation

Quarterly or on personnel change:
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `TURNSTILE_SECRET_KEY`

Steps: rotate in vendor dashboard → update Vercel env vars → trigger redeploy → verify `/api/health`.
