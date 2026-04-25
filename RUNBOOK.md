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
- [ ] Vercel envs audited: `UPSTASH_REDIS_REST_*` set (otherwise rate-limit is per-lambda only), `RESEND_FROM` uses verified domain, `TURNSTILE_*` set.
- [ ] `supabase/migrations/0002_hardening.sql` applied (audit_log table, RLS, immutability triggers).
- [ ] Test admin password rotation via `/admin/account` and confirm other sessions revoked.
- [ ] Print backup CSV of confirmed guests + load on a tablet that does not depend on Wi-Fi.

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
