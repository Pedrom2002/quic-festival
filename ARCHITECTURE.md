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

- **Public** (`anon` JWT or none): `/`, `/i/[code]`, `/api/rsvp`, `/api/qr/[token]`, `/api/ics/[token]`, `/api/invites/[code]`, `/api/csp-report`, `/api/sentry-tunnel`, `/confirmado/[token]`, `/privacidade`.
- **Authenticated, non-admin**: blocked by `/admin/(authed)/layout.tsx` allowlist check against `public.admins` (via `auth.uid()` after migration 0003).
- **Admin** (uid in `public.admins.user_id`): `/admin/*` and `/api/admin/*`.
- **Service role** (`SUPABASE_SERVICE_ROLE_KEY`): only invoked server-side via `supabaseAdmin()`. Bypasses RLS. Never reaches the client bundle.
- **Cron** (`CRON_SECRET`): GitHub Actions every 5min hits `/api/cron/email-retry` with `Authorization: Bearer`. Constant-time compare.

## Data model

Migrations 0001 → 0009 in `supabase/migrations/`:

- `guests` (id, name, email unique, phone, companion_*, token unique, checked_in_at, email_sent_at, ics text, invite_link_id FK, email_attempts, email_failed_at, email_last_error). RLS: admin select/update only; column-level immutability via trigger `guests_protect_immutable_columns_trg` for the `authenticated` role (only `checked_in_at`, `email_sent_at`, `ics`, `email_*` mutable). Service role bypasses for all writes.
- `admins` (email pk, user_id FK to auth.users). RLS deny-all for anon/authenticated; lookups via `is_admin(auth.uid())` SECURITY DEFINER.
- `audit_log` (append-only). RLS deny-all for anon/authenticated. UPDATE/DELETE triggers raise. Purge `audit_log_purge(retain_days)` scheduled by pg_cron at 04:00 UTC daily (180d retention).
- `idempotency_keys` (scope, key pk, response, status_code, expires_at). RLS deny-all. Purged hourly via pg_cron + `idempotency_keys_purge()`.
- `invite_links` (id, code unique, label, max_uses, uses_count, expires_at, archived_at, created_by, created_at). RLS admin-only SELECT; counter atomically updated via `claim_invite_seat(text)` SECURITY DEFINER (row-locked). `release_invite_seat(uuid)` for compensating insert failures.

## Request flow: RSVP

1. Browser POST `/api/rsvp` with zod-validated body (optionally `inviteCode` + `captchaToken` + `Idempotency-Key` header).
2. Middleware: CSRF (Sec-Fetch-Site / Origin), body-size cap.
3. Handler: kill-switch (`RSVP_OPEN`), idempotency cache lookup, Turnstile verify (when enabled), tiered rate-limit (per-IP, per-(IP,email), per-email-global).
4. Pre-dedup SELECT by email → if exists, sign + return existing token. Avoids consuming an invite seat for re-submits.
5. If `inviteCode` present: `claim_invite_seat(code)` row-locked → fail 409 (exhausted) / 410 (expired/not-found).
6. Insert guest via service role with `invite_link_id`, pre-rendered `ics`, `email_attempts=0`. Duplicate-by-PK race → release seat + dedup branch.
7. Sign QR token (HMAC-SHA256 over `<uuid>.<expMs>`). Send Resend email with QR + ICS as inline attachments.
8. Update `email_sent_at` + `email_attempts=1` on success; update `email_attempts=1 + email_last_error` on failure (cron retries up to MAX=3, then sets `email_failed_at`).
9. Cache idempotency response for 1h. Return `{ token }`. Client redirects to `/confirmado/[token]`.

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
| RGPD | `/privacidade` page, `DELETE /api/admin/guest/[id]`, `GET /api/admin/guest/[id]/export` (Art.15), audit retention | `src/app/privacidade`, `api/admin/guest/[id]` |
| QR token signing | HMAC-SHA256 (uuid.exp.sig), constant-time verify, dual-mode legacy UUID | `src/lib/qr-token.ts` |
| Invite seats | row-lock + atomic increment via `claim_invite_seat(code)` SECURITY DEFINER | `supabase/migrations/0008_invite_links.sql` |
| Email retry pipeline | Bounded attempts (MAX=3), `email_failed_at` flag, GH Actions cron 5min | `src/app/api/cron/email-retry`, `supabase/migrations/0009_*.sql` |
| CSP reporting | `report-uri` + Reporting-Endpoints → `/api/csp-report` (pino logger) | `src/middleware.ts`, `src/app/api/csp-report` |
| Sentry tunnel | `/api/sentry-tunnel` proxies envelope to ingest, gated on DSN match | `src/app/api/sentry-tunnel` |
| Logger | pino node-runtime + redact paths (auth, cookies, password, token, email) | `src/lib/logger.ts` |

## Out of scope

- Multi-tenant deployment.
- Payments / ticketing.
- I18n (PT-PT only).
- Real-time updates (admin page is `force-dynamic`, fresh on navigation).
