# Architecture

QUIC Festival 2026 RSVP. Single-event Next.js 16 app on Vercel + Supabase + Resend.

## Topology

```
Browser ──► Vercel Edge (middleware: CSP/CSRF/host/body-size) ──► Next.js route
                                                                  │
              ┌───────────────────────────────────────────────────┤
              ▼                       ▼                          ▼
       Supabase (Postgres+Auth)   Resend API           Upstash Redis (rate-limit)
                                                          + LRU fallback
```

## Trust boundaries

- **Public** (`anon` JWT or none): `/`, `/api/rsvp`, `/api/qr/[token]`, `/api/ics/[token]`, `/confirmado/[token]`, `/privacidade`.
- **Authenticated, non-admin**: blocked by `/admin/(authed)/layout.tsx` allowlist check against `public.admins`.
- **Admin** (email in `public.admins`): `/admin/*` and `/api/admin/*`.
- **Service role** (`SUPABASE_SERVICE_ROLE_KEY`): only invoked server-side via `supabaseAdmin()`. Bypasses RLS. Never reaches the client bundle.

## Data model

`supabase/migrations/0001_init.sql` + `0002_hardening.sql`:

- `guests` (id, name, email unique, phone, companion_*, token unique, checked_in_at, email_sent_at). RLS: admin select/update only; explicit deny on insert/delete for `authenticated`. Service role bypasses for all writes.
- `admins` (email pk). RLS: deny-all for `anon`/`authenticated`. Looked up via service role for the gate check.
- `audit_log` (append-only). RLS: deny-all for `anon`/`authenticated`. UPDATE/DELETE triggers raise. Purge function `audit_log_purge(retain_days)` for retention sweep.

## Request flow: RSVP

1. Browser POST `/api/rsvp` with zod-validated body.
2. Middleware: CSRF (Sec-Fetch-Site / Origin), body-size cap.
3. Handler: kill-switch (`RSVP_OPEN`), tiered rate-limit (per-IP, per-(IP,email), per-email-global).
4. Insert via service role. Duplicate email → 200 fake-success (no token, no email).
5. Send Resend email with QR link `/api/qr/[token]`.
6. Update `email_sent_at` (best-effort).
7. Return `{ token }`. Client redirects to `/confirmado/[token]`.

## Request flow: admin login

1. POST `/api/admin/sign-in` (password) or `/api/admin/sign-in/otp` (magic link).
2. Captcha verified server-side via `verifyTurnstile` (fail-closed in production).
3. Tiered rate-limit (per-IP, per-(IP,email), per-email-global).
4. `supabaseServer()` exchange. On success, audit `admin.signin.password.ok`.
5. Cookies set with HttpOnly + SameSite=Lax + Secure (prod).

## Request flow: check-in

1. `/admin/scan` decodes QR via `html5-qrcode`, PATCH `/api/admin/checkin` with token.
2. Handler: `requireAdmin()` (auth + allowlist).
3. Lookup guest by token. Update `checked_in_at`. Audit `admin.checkin.ok|duplicate|not_found|uncheck`.

## Defenses summary

| Class | Mechanism | Location |
|---|---|---|
| CSP | nonce + strict-dynamic per request, prod drops `https:`/`'unsafe-inline'` | `src/middleware.ts` |
| CSRF | `Sec-Fetch-Site` + Origin allowlist on `/api/*` mutations | `src/middleware.ts` |
| Host pinning | Redirect 308 from non-canonical Vercel URLs in prod | `src/middleware.ts` |
| Rate limit | Upstash REST (timeout 800ms) + LRU fallback | `src/lib/rate-limit.ts` |
| Captcha | Cloudflare Turnstile, fail-closed in prod | `src/lib/turnstile.ts` |
| RLS | deny-by-default on `guests`/`admins`/`audit_log` | `supabase/migrations/000{1,2}_*.sql` |
| Audit | append-only table, immutability triggers, 180d retention | `supabase/migrations/0002_hardening.sql` |
| User enumeration | dup RSVP returns 200 fake-success; generic OTP/login errors | `src/app/api/rsvp/route.ts`, `sign-in/{,otp}` |
| CSV injection | prefix `'` on cells starting with `=+-@\t\r` | `src/lib/csv.ts` |
| ICS injection | RFC 5545 escape | `src/lib/ics.ts` |
| Open redirect | path-internal allowlist on `/auth/callback?next=` | `src/app/auth/callback/route.ts` |
| RGPD | `/privacidade` page, `DELETE /api/admin/guest/[id]`, audit retention | `src/app/privacidade`, `api/admin/guest/[id]` |

## Out of scope

- Multi-tenant deployment.
- Payments / ticketing.
- I18n (PT-PT only).
- Real-time updates (admin page is `force-dynamic`, fresh on navigation).
