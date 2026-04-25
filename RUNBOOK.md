# Runbook · QUIC Festival RSVP

Operational guide for the festival weekend and steady state.

## Health check

`GET /api/health` returns 200 with `{ supabase: "ok", resend: "ok" }` when both are reachable. 503 otherwise.

## Common failure modes

### Email not delivering
1. Resend sandbox `onboarding@resend.dev` only delivers to the account owner. Verify domain `quic.pt` at https://resend.com/domains.
2. Check Resend dashboard → Logs for the recipient.
3. If a guest reports no email, admin can re-send from `/admin` row → "Reenviar".
4. Free tier limit: 100/day. Upgrade plan if RSVP traffic exceeds.

### Magic link not arriving
1. Supabase free tier limits OTP to ~2/h. Use password auth instead.
2. `/admin/login` Magic Link tab returns generic "if email exists, you receive a link" — even on rate-limit.

### Camera not opening at door
1. `/admin/scan` requires HTTPS. Vercel prod = OK. Local LAN over HTTP = fails.
2. iOS Safari requires user gesture. Tap the page first.
3. Manual fallback: type the QR token in the "Inserir token manualmente" panel.

### Rate-limit too aggressive
Defaults are intentionally tight. Raise via `src/lib/limits.ts` and redeploy. No env var override.

### Supabase down
- Read-only mode: `/admin` will 500. Check status.supabase.com.
- Mitigation at door: have a printed CSV of confirmed guests as fallback.

## Festival-day pre-flight (2 days before)

- [ ] `GET /api/health` returns 200 in production.
- [ ] At least one real RSVP submitted from a non-admin email; QR received; QR decoded by `/admin/scan` on iPhone + Android.
- [ ] Vercel envs audited: `UPSTASH_REDIS_REST_*` set (without these, rate-limit fails-closed in prod and returns 503 — see "Rate-limit degraded" below), `RESEND_FROM` uses verified domain, `TURNSTILE_*` set, `QR_TOKEN_SECRET` set (>= 32 random bytes — generate via `openssl rand -base64 48`), `CRON_SECRET` set (>= 32 bytes), `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set.
- [ ] CI repo secrets set for migrations workflow: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` (production). For staging: `SUPABASE_STAGING_ACCESS_TOKEN`, `SUPABASE_STAGING_DB_PASSWORD`, `SUPABASE_STAGING_PROJECT_REF`. Configure GitHub Environments → `production` with required reviewers so prod migrations gate on manual approval.
- [ ] All migrations applied in order: `0001_init.sql`, `0002_hardening.sql`, `0003_rls_uid_and_columns.sql`, `0004_idempotency_keys.sql`, `0005_idempotency_keys_cron.sql`, `0006_audit_retention_cron.sql`. Handled by `db-migrate.yml` on master push (staging → manual approval → production).
- [ ] `pg_cron` extension enabled on the Supabase project. Dashboard → Database → Extensions → search "pg_cron" → toggle ON. Required by 0005 + 0006.
- [ ] `admins.user_id` populated for every admin row. Migration 0003 backfills via `lower(email)` match; verify and remediate manually:
      ```sql
      -- Audit
      select email, user_id from public.admins;
      -- Remediation if any user_id IS NULL (replace email):
      update public.admins a
      set user_id = u.id
      from auth.users u
      where a.user_id is null and lower(a.email) = lower(u.email);
      ```
- [ ] `cron.job` shows BOTH cron jobs scheduled:
      ```sql
      select jobname, schedule, active from cron.job
       where jobname in ('audit_log_retention', 'idempotency_keys_purge');
      ```
- [ ] Vercel cron job `email-retry` is listed under Project Settings → Cron Jobs.
- [ ] Test admin password rotation via `/admin/account` and confirm other sessions revoked.
- [ ] Print backup CSV of confirmed guests + load on a tablet that does not depend on Wi-Fi.

## Rate-limit degraded (Upstash outage)

In production, when Upstash Redis is unreachable the rate-limiter fails closed: `rateLimit()` returns `{ ok: false, degraded: true }` and protected routes respond 503 instead of allowing through. This is intentional — better a temporary 503 burst than unbounded RSVP/sign-in spam.

Observe: Sentry will fire on the warn `[rate-limit] upstash falhou:`. If the outage is sustained:
1. Check Upstash status and the project quota (free tier daily cap).
2. Temporarily route to a hot standby Redis by updating `UPSTASH_REDIS_REST_*` envs and redeploying.
3. As a last resort, unset both Upstash envs to fall back to the per-lambda in-memory limiter (degrades but does not block).

## QR token rotation

Tokens are HMAC-signed (`<uuid>.<exp>.<sig>`) using `QR_TOKEN_SECRET`. Rotate the secret:
1. Generate new secret (32+ random bytes).
2. Update `QR_TOKEN_SECRET` in Vercel envs and redeploy.
3. All QRs in already-sent emails immediately become invalid. Use `POST /api/admin/resend-email` (or the bulk cron `email-retry` after clearing `email_sent_at`) to issue fresh ones.
4. UUID-only legacy tokens are rejected when secret is set; keep this in mind before rotating during the event window.

## Email retry cron

External driver: GitHub Actions workflow `email-retry-cron.yml` runs `*/5 * * * *` and `curl`s `GET /api/cron/email-retry` with `Authorization: Bearer ${CRON_SECRET}`. Vercel Hobby plan caps cron at daily, so the schedule lives in GitHub Actions instead. Upgrade to Vercel Pro and move the schedule into `vercel.json` if the GH Actions delays become noticeable.

Manually trigger via:

```
curl -H "x-cron-secret: $CRON_SECRET" https://quic.pt/api/cron/email-retry
```

Job re-tries up to 25 RSVPs per run with `email_sent_at IS NULL` and `created_at >= now() - 1h`. Older candidates are abandoned by design (any guest from > 1h ago should be picked up by the admin "Reenviar" UI, not the cron).

## Load testing

`npm run load:rsvp` (requires `k6` installed locally). Targets `BASE_URL` (default `http://localhost:3000`). Staged ramp 0 → 50 VUs over 2 min. Run before each event against staging — never against prod once RSVP is live.

## RLS contract test

Live RLS validation runs in `.github/workflows/rls-contract.yml` on PRs touching migrations and on a daily cron. Local repro:

```
supabase start
SUPABASE_RLS_TEST_URL=$(supabase status -o env | grep API_URL | cut -d= -f2) \
SUPABASE_RLS_TEST_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2) \
SUPABASE_RLS_TEST_SERVICE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2) \
npx vitest run tests/rls/contract.test.ts
```

## Key rotation

Quarterly. Steps:
1. Vendor dashboard → rotate key.
2. Vercel → Settings → Environment Variables → update + redeploy.
3. `GET /api/health` to verify.
4. Old key remains valid for ~24h on most vendors; revoke once confirmed.

## RGPD data deletion

User emails `ola@quic.pt` requesting deletion. Admin authenticates and:
- Manual: Supabase Studio → `delete from public.guests where email = '<email>'`.
- Endpoint: `DELETE /api/admin/guest/[id]` (admins only, audited).

`audit_log` retains the deletion record (purged automatically after 180 days via `audit_log_purge`).

## Backups

Supabase Pro = daily backups, 7-day retention. Free tier = no backup. Ensure prod project is on Pro before festival.
Manual export: `GET /api/admin/export` daily during the RSVP window; archive in a secure location.

## Escalation

- Pedro: pedro.marques@quic.pt
- Rafael: rafael.amado@quic.pt
- Vercel support: https://vercel.com/help
- Supabase support: https://supabase.com/support
