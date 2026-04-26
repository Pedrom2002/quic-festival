# QUIC Festival · RSVP

App web de RSVP para o **QUIC Festival 2026**. Substitui Google Form por landing
própria com email de confirmação + QR code, painel admin para gestão de
convidados, scanner QR para check-in à porta e audit log self-hosted.

Prod: <https://quic-festival.vercel.app>

## Stack

- **Next.js 16** (App Router, Turbopack opcional, webpack default) + TypeScript
- **Supabase** — Postgres + Auth (password + magic link OTP) + RLS
- **Resend** — email transacional + `qrcode` p/ QR embed via URL `/api/qr/[token]`
- **Tailwind CSS 4**
- **Upstash Redis REST** — rate-limit persistente em serverless (com fallback LRU em memória se env vars ausentes)
- **react-hook-form** + **zod**
- **Framer Motion** — stagger animations
- **html5-qrcode** — leitor de câmara em `/admin/scan`
- **@vercel/analytics** — tráfego básico
- Deploy: **Vercel** (auto-deploy on push to `master`)

## Setup local

```bash
cp .env.example .env.local
# preencher chaves Supabase + Resend (+ opcional Upstash)
npm install
npm run dev          # webpack
# OR
npm run dev -- --turbopack    # turbopack
```

### Supabase

1. Criar projeto em <https://supabase.com>
2. SQL editor: correr todas as migrations em `supabase/migrations/` por ordem (0001 → 0009). Ou via CLI: `supabase link --project-ref <ref>` + `supabase db push --include-all`.
   - `0001_init.sql` — `guests`, `admins`
   - `0002_hardening.sql` — `audit_log` + RLS + triggers de imutabilidade + retention helper
   - `0003_rls_uid_and_columns.sql` — RLS via `auth.uid()` + immutable-columns trigger
   - `0004_idempotency_keys.sql` — cache de respostas RSVP
   - `0005_idempotency_keys_cron.sql` — pg_cron purge horário
   - `0006_audit_retention_cron.sql` — pg_cron purge audit_log (180d)
   - `0007_guests_ics_cache.sql` — `guests.ics` text col
   - `0008_invite_links.sql` — sistema de convites
   - `0009_email_failure_tracking.sql` — `email_attempts/failed_at/last_error`
3. Activar extension `pg_cron` no dashboard (Database → Extensions). Necessário para 0005 e 0006.
4. SQL editor: correr `supabase/seed.sql` (insere admins em `public.admins`)
5. Auth → **URL Configuration**: adicionar `http://localhost:3000/**` e URL prod ao redirect allowlist.
6. (Opcional) agendar retenção via pg_cron:
   ```sql
   select cron.schedule('audit_log_retention', '0 4 * * *',
     $$ select public.audit_log_purge(180) $$);
   ```
7. Definir password de admin (opcional, alternativa ao magic link). Pelo Studio
   ou via Admin API:
   ```bash
   curl -X PUT "$SUPABASE_URL/auth/v1/admin/users/<USER_ID>" \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"password":"<random-strong-password>"}'
   ```

### Resend

- **Dev / sandbox**: `onboarding@resend.dev` — só entrega emails para o owner da conta Resend.
- **Prod**: verificar domínio (`quic.pt`) em <https://resend.com/domains>. Colar
  DNS records (MX `send`, TXT SPF `send`, TXT DKIM `resend._domainkey`) no DNS
  provider. Após "Verified", trocar `RESEND_FROM` para `QUIC Festival <ola@quic.pt>`.

### Upstash (opcional)

Criar DB em <https://console.upstash.com/redis> → tab REST API → copiar URL +
TOKEN para env vars. Sem isto, rate-limit usa fallback LRU em memória — funciona
local mas em Vercel é per-lambda (cada cold start = contador novo).

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # server-only
RESEND_API_KEY
RESEND_FROM                        # obrigatório em produção (throw se ausente)
NEXT_PUBLIC_SITE_URL               # ex.: https://quic.pt OU https://quic-festival.vercel.app
UPSTASH_REDIS_REST_URL             # opcional (sem isto → fallback memória per-lambda)
UPSTASH_REDIS_REST_TOKEN
TURNSTILE_SECRET_KEY               # obrigatório em produção (fail-closed se ausente)
NEXT_PUBLIC_TURNSTILE_SITE_KEY     # par do anterior
RSVP_OPEN                          # opcional, "false" desliga /api/rsvp (kill-switch)

# QR signing
QR_TOKEN_SECRET                    # >= 32 bytes random; emite tokens HMAC-SHA256
QR_TOKEN_TTL_MS                    # opcional, default ~6 meses

# Cron auth
CRON_SECRET                        # >= 32 bytes; partilhado entre /api/cron/email-retry e o GitHub Actions cron

# Sentry (opcional)
SENTRY_DSN                         # server runtime
NEXT_PUBLIC_SENTRY_DSN             # browser runtime; SDK 10 com tunnel /api/sentry-tunnel
```

### Sistema de convites (`/i/<code>`)

Admin gera links com N vagas em `/admin/invites`. Estrutura:

- `invite_links(id, code unique, label, max_uses, uses_count, expires_at, archived_at, created_by, created_at)`
- `guests.invite_link_id` FK (nullable, audit/dashboard).
- `claim_invite_seat(text)` SECURITY DEFINER — row-locked atomic increment.
- `release_invite_seat(uuid)` — usado quando o insert do guest falha após claim.

Fluxo público:
1. Admin cria invite → recebe link `/i/<CODE>` (12 chars Crockford base32).
2. Convidado abre `/i/<CODE>` → form pré-tagged com inviteCode.
3. Submit → `POST /api/rsvp { ..., inviteCode }` → `claim_invite_seat` → insert guest com `invite_link_id` → email QR.
4. Quando `uses_count == max_uses` → 409 "Convite esgotado." Quando `expires_at < now()` → 410 "Convite expirado."

Concessão UX: dedup do email via invite re-emite token do registo existente sem consumir nova vaga (pre-check antes do claim).

### Email failure tracking

Colunas em `guests`:
- `email_attempts` — incrementado no envio (RSVP) e em cada retry do cron.
- `email_failed_at` — flagged quando atinge `MAX_EMAIL_ATTEMPTS = 3`.
- `email_last_error` — última mensagem do provider (truncada 500 chars).

`/admin` mostra contador de "Emails falhados" (rose card). Cron `/api/cron/email-retry` ignora rows com `email_failed_at` set ou `email_attempts >= 3`.

## Rotas

### Públicas

| Método | Rota | Função |
|---|---|---|
| GET | `/` | Landing + form RSVP + lineup |
| GET | `/privacidade` | Política RGPD |
| GET | `/i/[code]` | Landing de convite (label + vagas restantes + form RSVP) |
| POST | `/api/rsvp` | Insere guest, envia email com QR. Aceita `inviteCode` opcional. Turnstile obrigatório se keys setadas. Rate-limit 10/min/IP + 3/min/(IP,email) + 5/h/email. Kill-switch via `RSVP_OPEN=false`. |
| GET | `/confirmado/[token]` | Página pós-submit com QR (noindex, noarchive) |
| GET | `/api/qr/[token]` | PNG do QR (rate-limit 60/min/IP, cache `private, max-age=60`) |
| GET | `/api/ics/[token]` | Calendar `.ics` (rate-limit 30/min/IP, noindex). Pré-renderizado no insert (col `guests.ics`). |
| GET | `/api/invites/[code]` | Metadata mínima do invite (label + vagas restantes). Rate-limit 60/min/IP. |
| POST | `/api/csp-report` | Receiver de CSP violations (legacy + Reporting API). |
| POST | `/api/sentry-tunnel` | Proxy para ingest Sentry (404 quando DSN unset). |
| GET | `/api/health` | Verifica Supabase + Resend; 200 ou 503 |

### Auth

| Método | Rota | Função |
|---|---|---|
| GET | `/admin/login` | Form de login (password OU magic link) |
| POST | `/api/admin/sign-in` | Password auth (rate-limit 5/5min/IP) |
| POST | `/api/admin/sign-in/otp` | Pede magic link (rate-limit 3/10min/IP) |
| GET | `/auth/callback?code=&next=` | Troca code por session, valida `next` interno |
| POST | `/api/admin/signout` | Limpa session, redirect login |

### Admin (gated por session + allowlist `admins`)

| Método | Rota | Função |
|---|---|---|
| GET | `/admin` | Stats live (auto-refresh 30s) + tabela convidados (filter, sort, check-in toggle, resend) |
| GET | `/admin/scan` | Scanner QR câmara + input manual de token |
| GET | `/admin/audit` | Viewer audit_log (filtros, badges) |
| GET | `/admin/invites` | CRUD de invite links (criar, copiar, arquivar) |
| GET | `/admin/account` | Mudar password |
| PATCH | `/api/admin/checkin` | Toggle `checked_in_at` (aceita `id` ou `token`) |
| POST | `/api/admin/resend-email` | Reenvia email + QR |
| GET | `/api/admin/export` | CSV stream (com formula injection guard, filename em tz Lisboa) |
| POST | `/api/admin/account/password` | Mudar password (re-auth com current) |
| DELETE | `/api/admin/guest/[id]` | RGPD: eliminar inscrição (audit `admin.guest.deleted` com email_hash) |
| GET | `/api/admin/guest/[id]/export` | RGPD Art.15: JSON com data subject + audit trail (audit `admin.guest.exported`) |
| GET | `/api/admin/invites` | Lista invites (active + archived) |
| POST | `/api/admin/invites` | Criar invite (`label`, `max_uses` 1..1000, `expires_at?`) |
| PATCH | `/api/admin/invites/[id]` | Archive / unarchive |

## Segurança

Implementado (ver `next.config.ts`, `src/middleware.ts`, `src/lib/rate-limit.ts`):

- **Headers**: HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (camera só self), CSP completo.
- **CSRF**: middleware verifica `Sec-Fetch-Site === same-origin` ou `Origin === SITE_URL` em mutações `/api/*`.
- **Cookies**: HttpOnly + SameSite=Lax + Secure (prod).
- **RLS**: `guests` (admin select/update), `admins` (deny all anon/authenticated), `audit_log` (deny all anon/authenticated). Service role bypass.
- **Rate-limit**: Upstash Redis REST + fallback memória.
- **User enumeration**: RSVP duplicado devolve `200 {ok:true}` sem token; mensagem genérica no frontend.
- **Brute-force login**: server-side rate-limit 5/5min em sign-in password e OTP.
- **CSV formula injection**: prefix `'` em cells iniciados por `=+-@\t\r`.
- **Open redirect**: `/auth/callback?next=` valida path interno (rejeita `//`, `\\`, URLs absolutas, CRLF).
- **PII**: `/confirmado` + `/api/ics` com `noindex/noarchive/nocache`.
- **Audit log**: sign-in (ok/fail), signout, checkin, resend, export → `public.audit_log`.

Pendente:
- Verificar domínio quic.pt em Resend (sandbox `onboarding@resend.dev` só entrega ao owner da conta).
- Rotação periódica de `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` e PAT.
- Sentry / external monitoring se quisermos alertas push (atualmente self-hosted via `/admin/audit`).

## Deploy (Vercel)

```bash
vercel link --project quic-festival
# adicionar env vars (production):
vercel env add <NAME> production    # uma a uma
vercel --prod --yes                 # primeiro deploy
```

GitHub auto-deploy: ligado. Push para `master` → build → prod (~30s).

Para forçar manualmente:
```bash
vercel --prod --yes
```

## Check-in à porta no dia do festival

1. Login no telemóvel/tablet em `/admin/login` → password.
2. Abrir `/admin/scan` → permitir câmara.
3. Apontar a cada QR de convidado. Feedback verde/amarelo/vermelho + vibração.
4. Sem câmara: usar input manual em `/admin/scan` ou `/admin` → toggle Check-in.

## Testes

Suite com **Vitest 4** (279 unit/integração) + **Playwright** (24 e2e específicos) + **@axe-core/playwright** (a11y).

Coverage v8 actual: **99.75% lines / 98.23% statements / 95.7% branches / 92.26% functions**. Threshold CI bloqueia abaixo de 99/98/95/92.

```bash
npm run test            # vitest run (unit)
npm run test:watch      # vitest watch
npm run test:cov        # coverage HTML em ./coverage/index.html
npm run e2e             # playwright (precisa Next a correr ou usa webServer integrado)
npm run e2e:ui          # modo interactivo
npm run audit           # npm audit prod deps high+
npm run verify          # lint + tsc --noEmit + test:cov (gate pré-commit)
```

Estrutura:

```
tests/
  unit/
    lib/                # validators, csv, ics, qr, rate-limit, audit, turnstile, email, supabase x3
    middleware.test.ts  # CSP, CSRF, host enforce, body-size
    api/                # 11 ficheiros, 1 por route handler
    components/         # rsvp-form, guests-table, qr-scanner, account-form, turnstile, scene, blobs, lineup, confirmado-actions
    app/                # pages (server + client) + robots + sitemap + layouts
    edge-cases.test.tsx # branches residuais (origin malformado, redirect null, magic-link reject, etc.)
  e2e/
    smoke.spec.ts        # 4 specs: CSP nonce, /admin redirect, UUID guard, form visível
    rsvp-flow.spec.ts    # 5 specs: validação client, success, rate-limit, dedup, acompanhante toggle
    admin-login.spec.ts  # 5 specs: password+OTP success/erro/rate-limit
    security.spec.ts     # 6 specs: HSTS/X-Frame/CSP/CSRF/body-size/UUID guard
    a11y.spec.ts         # 2 specs: axe wcag2a/wcag2aa em / e /admin/login
    rate-limit.spec.ts   # skip sem Upstash; 1 spec: 11ª submissão = 429
    confirmado-pii.spec.ts # skip sem E2E_TEST_TOKEN seed; 1 spec: noindex meta
  setup/vitest.setup.ts
  mocks/server.ts        # MSW setupServer
  mocks/supabase.ts      # factory parametrizável (auth + from().select/insert/update/eq/maybeSingle)
```

Mocks externos:
- `qrcode` lib via `vi.mock` (toDataURL/toBuffer determinístico)
- `html5-qrcode` via mock class — happy/error paths + camera missing
- `framer-motion` via Proxy (filtra props animação para evitar warnings em jsdom)
- Supabase clients (admin/server/browser) via mock factories
- Resend via `class FakeResend` constructor stub
- MSW v2 para Upstash Redis REST + Cloudflare Turnstile siteverify

E2E mock backend via `page.route()` para evitar Supabase/Resend reais. Specs com prefixo `rate-limit`/`confirmado-pii` correm só com env vars opcionais (Upstash, seed token).

CI: [`.github/workflows/test.yml`](.github/workflows/test.yml) — lint + tsc + unit matrix (Node 20+22) + Playwright chromium + a11y. Falha se threshold cov não bater.

**Caveat honesto:** 99.75% lines não prova correctness. Não cobertos por unit/playwright headless:
- **Scanner real** em telemóvel iOS/Android (jsdom + html5-qrcode mock não simula decode de câmara)
- **Email rendering** Gmail/Outlook/Apple Mail (HTML dark-mode lock testado só em DOM, não cliente real)
- **RLS Supabase** com session anon vs service_role (mocks bypassam policies — precisa `supabase start` + Docker)
- **Turnstile real** chave Cloudflare (test usa `TURNSTILE_SECRET_KEY=` empty → skipped)
- **Three.js scene** decorativa — só smoke render, sem visual snapshot
- **Mutation testing** (Stryker) — não config, custo alto em CI
- **Visual regression** (Percy/Chromatic) — não config, requer SaaS

Branches/linhas residuais (~1%) são paths defensivos marcados com `/* v8 ignore */` cirúrgico:
- `rate-limit.ts:37` — guard `!url || !token` já filtrado por caller
- `turnstile.ts:46` — `e instanceof Error` non-Error catch
- `turnstile.tsx:31,79` — `typeof window === undefined` edge runtime, cancelled cleanup race
- `middleware.ts` — outer catch `originAllowed` quando `new URL` rebenta
- API routes — defensive `console.error` calls
- Login page — `.catch(() => null)` em fetch reject (testado em ambos os modes)

Para ir a 100% real → precisa Supabase local, ffmpeg para gerar `qr.y4m`, Stryker run, Litmus email checker. Esses passos levam ~3 dias adicionais de setup.

## Troubleshooting

- **Email não chega**: Resend sandbox só envia para owner. Verificar domínio quic.pt.
- **Magic link rate-limited (Supabase free tier 2/h)**: usar password auth ou pedir para gerar link via Admin API.
- **Câmara não abre em `/admin/scan`**: requer HTTPS. Localhost funciona; LAN IP via http NÃO.
- **Vercel não auto-deploya pós-push**: `vercel --prod --yes` força deploy do HEAD local.
- **Build falha com Turbopack**: passar para webpack — `next dev --webpack` ou remover flag.

## Estrutura

```
src/
  app/
    page.tsx                  Landing
    api/rsvp/route.ts         POST submit
    api/qr/[token]/route.ts   PNG QR
    api/ics/[token]/route.ts  Calendar
    confirmado/[token]/       Pós-submit
    auth/callback/            OAuth callback
    admin/
      login/                  Login (password + magic)
      (authed)/               Route group protegido
        layout.tsx            Auth gate
        page.tsx              Tabela
        scan/                 QR scanner
        audit/                Audit log viewer
        account/              Password change
    api/admin/
      sign-in/                POST password
      sign-in/otp/            POST magic link
      signout/
      checkin/
      resend-email/
      export/
      account/password/
  components/
    rsvp-form.tsx
    scene.tsx                 Stars/lights/scenery
    lineup.tsx
    confirmado-actions.tsx
    admin/guests-table.tsx
    admin/qr-scanner.tsx
    admin/account-form.tsx
  lib/
    supabase/{client,server,admin}.ts
    validators.ts             zod schemas
    rate-limit.ts             Upstash + LRU
    audit.ts                  audit_log helper
    email.ts                  Resend template
    qr.ts                     data URL helper
    ics.ts                    .ics builder
    csv.ts                    CSV + formula injection guard
  middleware.ts               CSRF guard /api/*
supabase/
  migrations/0001_init.sql
  seed.sql
```
