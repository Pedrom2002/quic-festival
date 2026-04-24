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
2. SQL editor: correr `supabase/migrations/0001_init.sql`
3. SQL editor: correr `supabase/seed.sql` (insere admins em `public.admins`)
4. Aplicar SQL extra para hardening:
   ```sql
   alter table public.admins enable row level security;
   create policy admins_no_anon on public.admins for all to anon, authenticated using (false) with check (false);

   create table if not exists public.audit_log (
     id bigserial primary key,
     occurred_at timestamptz not null default now(),
     actor_email text,
     action text not null,
     target_id uuid,
     ip text,
     meta jsonb
   );
   alter table public.audit_log enable row level security;
   create policy audit_log_no_anon on public.audit_log for all to anon, authenticated using (false) with check (false);
   create index audit_log_occurred_idx on public.audit_log(occurred_at desc);
   create index audit_log_actor_idx on public.audit_log(actor_email);
   ```
5. Auth → **URL Configuration**: adicionar `http://localhost:3000/**` e URL prod ao redirect allowlist.
6. Definir password de admin (opcional, alternativa ao magic link). Pelo Studio
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
SUPABASE_SERVICE_ROLE_KEY        # server-only
RESEND_API_KEY
RESEND_FROM                      # ex.: "QUIC Festival <onboarding@resend.dev>"
NEXT_PUBLIC_SITE_URL             # ex.: https://quic.pt OU https://quic-festival.vercel.app
UPSTASH_REDIS_REST_URL           # opcional
UPSTASH_REDIS_REST_TOKEN         # opcional
```

## Rotas

### Públicas

| Método | Rota | Função |
|---|---|---|
| GET | `/` | Landing + form RSVP + lineup |
| POST | `/api/rsvp` | Insere guest, envia email com QR. Rate-limit 10/min/IP + 3/min/(IP,email). |
| GET | `/confirmado/[token]` | Página pós-submit com QR (noindex, noarchive) |
| GET | `/api/qr/[token]` | PNG do QR (rate-limit 60/min/IP, cache 1y) |
| GET | `/api/ics/[token]` | Calendar `.ics` (rate-limit 30/min/IP, noindex) |

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
| GET | `/admin` | Stats + tabela convidados (filter, sort, check-in toggle, resend) |
| GET | `/admin/scan` | Scanner QR câmara + input manual de token |
| GET | `/admin/audit` | Viewer audit_log (filtros, badges) |
| GET | `/admin/account` | Mudar password |
| PATCH | `/api/admin/checkin` | Toggle `checked_in_at` (aceita `id` ou `token`) |
| POST | `/api/admin/resend-email` | Reenvia email + QR |
| GET | `/api/admin/export` | CSV stream (com formula injection guard) |
| POST | `/api/admin/account/password` | Mudar password (re-auth com current) |

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
