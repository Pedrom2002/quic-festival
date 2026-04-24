# QUIC Festival · RSVP

App web de RSVP para o QUIC Festival 2026. Substitui Google Form por landing própria com email de confirmação e QR code, mais painel admin para gestão de convidados.

## Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Postgres + Auth magic link + RLS)
- Resend (email transacional) + `qrcode` (QR embed)
- Tailwind CSS 4
- `react-hook-form` + `zod`
- Deploy: Vercel

## Setup local

```bash
cp .env.example .env.local
# preencher Supabase + Resend keys
npm install
npm run dev
```

### Supabase

1. Criar projeto em supabase.com
2. No SQL editor correr `supabase/migrations/0001_init.sql`
3. Correr `supabase/seed.sql` (inserir email admin em `public.admins`)
4. Em Auth → URL Configuration, adicionar `http://localhost:3000/auth/callback` (dev) e URL de prod

### Resend

- Dev: usar domínio `onboarding@resend.dev`
- Prod: adicionar e verificar DNS do domínio real

## Rotas

| Rota | Função |
|---|---|
| `GET /` | Landing + form RSVP |
| `POST /api/rsvp` | Insere guest, gera QR, envia email |
| `GET /confirmado/[token]` | Página pós-submit com QR |
| `GET /admin/login` | Magic link login |
| `GET /admin` | Tabela de convidados |
| `PATCH /api/admin/checkin` | Alterna `checked_in_at` |
| `GET /api/admin/export` | Stream CSV |

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # server-only
RESEND_API_KEY
RESEND_FROM
NEXT_PUBLIC_SITE_URL
```

## Deploy (Vercel)

1. Importar repo no Vercel
2. Adicionar env vars (service role e API key como secret)
3. Em Supabase adicionar URL de prod à allowlist de redirects
4. Smoke test: submeter inscrição, confirmar email + QR + `/admin`
