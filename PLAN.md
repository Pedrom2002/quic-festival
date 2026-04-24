# Quit Festival — RSVP Form App

## Context

Substituir um Google Form por uma app web própria de registo de convidados do **Quit Festival** (festival de música). Cada convidado recebe um link público, preenche os dados, recebe email de confirmação com QR code para check-in no dia. A organizadora precisa de um painel admin protegido para ver e exportar todas as inscrições.

Objetivo: form bonito de verdade (estética poster art / orgânica / colorida, estilo Primavera Sound / NOS Alive), com back-end robusto, deploy gratuito em Vercel.

**Diretório do projeto (vazio):** `c:/Users/P02/Downloads/Quic`

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** (Postgres + Auth para admin + RLS)
- **Tailwind CSS** + **shadcn/ui**
- **react-hook-form** + **zod** (validação)
- **Framer Motion** (animações orgânicas)
- **Resend** (email transacional)
- **qrcode** (geração de QR)
- Deploy: **Vercel**

## Estrutura de Pastas

```
src/
  app/
    layout.tsx                      fontes, overlay grain, providers
    page.tsx                        landing: hero + lineup + form RSVP
    confirmado/[token]/page.tsx     página de confirmação com QR
    admin/
      layout.tsx                    shell protegido por auth
      page.tsx                      tabela + filtros + export CSV
      login/page.tsx                login por magic link
    api/
      rsvp/route.ts                 POST: insere convidado, envia email, devolve token
      admin/checkin/route.ts        PATCH: marca checked_in_at
      admin/export/route.ts         GET: stream CSV
  components/
    rsvp-form.tsx                   form client, zod, UX otimista
    hero.tsx                        hero assimétrico com blobs SVG
    lineup.tsx                      grid de artistas (placeholder)
    blob.tsx                        SVG blob animado reutilizável
    grain.tsx                       overlay grain fixo
    admin/guests-table.tsx          tabela shadcn com search/filter
    admin/export-button.tsx         dispara /api/admin/export
    ui/*                            componentes shadcn
  lib/
    supabase/client.ts              cliente browser
    supabase/server.ts              cliente server (cookies)
    supabase/admin.ts               cliente service-role (apenas server)
    validators.ts                   schemas zod (regex telefone PT)
    email.ts                        Resend + template PT-PT
    qr.ts                           generateQrDataUrl(token)
    csv.ts                          toCsv(rows)
  styles/globals.css                layers Tailwind, CSS vars de paleta
supabase/
  migrations/0001_init.sql          schema + RLS
```

## Schema da Base de Dados

`supabase/migrations/0001_init.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  phone text not null,
  companion_count int not null default 0 check (companion_count between 0 and 5),
  companion_names text[] not null default '{}',
  token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz,
  email_sent_at timestamptz
);

create index guests_token_idx on public.guests(token);
create index guests_created_idx on public.guests(created_at desc);

create table public.admins (
  email text primary key
);

alter table public.guests enable row level security;

-- Sem políticas públicas. Todas as escritas passam pelo API route com service-role.
create policy "admin_select" on public.guests
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.admins));

create policy "admin_update" on public.guests
  for update to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.admins))
  with check (auth.jwt() ->> 'email' in (select email from public.admins));
```

Seed do primeiro admin (correr uma vez no SQL editor):
```sql
insert into public.admins(email) values ('pedro.marques@quic.pt'), ('rafael.amado@quic.pt');
```

## Scaffolding (comandos iniciais)

```bash
cd c:/Users/P02/Downloads/Quic
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
npm i @supabase/supabase-js @supabase/ssr react-hook-form zod @hookform/resolvers framer-motion resend qrcode
npm i -D @types/qrcode
npx shadcn@latest init
npx shadcn@latest add button input label form textarea checkbox radio-group table badge toast dropdown-menu dialog
```

## Variáveis de Ambiente (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM="Quit Festival <ola@quit.pt>"
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Fluxo de Submissão

Client form (react-hook-form + zod) faz POST para **API route** `/api/rsvp` (não Server Action). Motivo: service-role key pertence apenas ao server, API routes têm superfície estável para rate-limit, e tipagem de erros é mais limpa.

Passos do handler:
1. Valida body com zod
2. Insere via client service-role
3. Gera QR com `qrcode.toDataURL(token)`
4. Envia email Resend com QR embed (CID ou data URL)
5. Atualiza `email_sent_at`
6. Devolve `{ token }` ao cliente
7. Cliente faz `router.push('/confirmado/' + token)`

Rate-limit: LRU em memória para dev; Upstash Redis em prod (chave = IP + hash do email).

Erros PT-PT: email duplicado → "Este email já está registado.".

## Auth do Admin

Supabase Auth com magic link. `src/app/admin/layout.tsx` usa `createServerClient`, lê sessão, verifica email contra tabela `admins`, redireciona para `/admin/login` se falhar.

## Direção Visual

**Paleta (poster art quente):**
- `#F4E4C1` creme papel (fundo)
- `#E8613C` laranja queimado (destaque)
- `#3B5BA5` azul ultramarino
- `#F2B544` amarelo mostarda
- `#1A1A1A` tinta (texto)

**Fontes (Google Fonts):**
- **Fraunces** (serif display, cortes itálicos para títulos)
- **DM Sans** (sans body)
- **Caveat** (opcional, captions handwritten tipo "faltam X dias")

**Momentos de animação (Framer Motion):**
1. Hero: 3 blobs SVG morphing no `d` path em loop de 12s, parallax subtil no mouse
2. Form: campos entram com stagger `whileInView` (fade + rise) ao fazer scroll
3. Sucesso: badge do QR entra com spring suave, blobs-confetti atravessam o ecrã
4. Lineup: cartões com leve rotação random no hover (vibe stickers)

**Textura:** overlay grain SVG fixo a ~6% opacidade sobre toda a página.

## Ficheiros Críticos

- `src/app/api/rsvp/route.ts` — inserção + email + QR
- `src/components/rsvp-form.tsx` — form principal
- `src/app/page.tsx` — landing + hero + lineup + form
- `src/app/confirmado/[token]/page.tsx` — página pós-submit com QR
- `src/app/admin/page.tsx` — tabela de convidados
- `src/app/admin/layout.tsx` — gate de auth + allowlist
- `supabase/migrations/0001_init.sql` — schema + RLS
- `src/lib/email.ts` — template Resend em PT-PT
- `src/lib/qr.ts` — geração do QR data URL
- `src/lib/validators.ts` — schema zod (regex telefone PT: `^(\+351)?\s?9\d{8}$`)

## Verificação Local

1. `npm run dev`, abrir `http://localhost:3000`, inspecionar hero + form
2. Submeter form com dados válidos, confirmar redirect para `/confirmado/[token]`
3. Supabase Studio: confirmar linha em `guests` com `token` e `email_sent_at` preenchidos
4. Resend dashboard (ou sandbox `onboarding@resend.dev`): confirmar entrega e QR renderiza
5. Negativo: email duplicado devolve erro PT "Este email já está registado."
6. `/admin/login`: pedir magic link, autenticar, ver tabela, marcar um convidado como checked-in, exportar CSV, abrir em Excel e confirmar headers PT

## Deployment

1. Criar projeto Supabase, correr `0001_init.sql` no SQL editor, inserir email admin em `public.admins`
2. Resend: usar `resend.dev` em dev; em prod adicionar DNS records do domínio `quit.pt` e verificar
3. Vercel: importar repo, adicionar todas as env vars da secção acima (marcar `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` como secret), `NEXT_PUBLIC_SITE_URL` = URL de prod
4. Supabase Auth: adicionar URL de prod ao allowlist de redirects (para magic links funcionarem em prod)
5. Smoke test pós-deploy: submeter uma inscrição real, confirmar email + QR + ver em `/admin`

## Fora do Scope (para depois)

- App de scanner de QR no dia do festival (podem usar qualquer app genérica de scan + rota `/api/admin/checkin`)
- Página de lineup real com artistas e horários
- Upload de imagens do poster
- Internacionalização (só PT por agora)
- Integração de pagamento (se bilhetes forem pagos)
