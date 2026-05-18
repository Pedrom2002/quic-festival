# Goalfest — Design Spec

**Data:** 2026-05-18
**Base:** Fork do repo QUIC (pedrom2002/quic-festival)

---

## Contexto

Goalfest é a fanzone oficial do Mundial 2026 em Lisboa (Parque das Nações, 11 Jun – 19 Jul 2026), organizada pela QUIC NATION. O site combina:

- **Landing pública** com informações do evento, calendário de jogos, venue, sponsors e FAQ (visual da fanzone website já existente)
- **Sistema de gestão de convidados VIP** (backend do QUIC: convites por link, RSVP, QR code, checkin, acreditações media, painel admin)

A zona VIP é acedida por convite — o fluxo é idêntico ao QUIC: admin cria link → utilizador regista-se via `/i/[code]` → recebe QR por email → scan no evento.

---

## Stack

Idêntica ao QUIC (sem alterações):

| Tecnologia | Uso |
|---|---|
| Next.js 15 (App Router, nodejs runtime) | Framework |
| Tailwind CSS v4 | Styling |
| Framer Motion | Animações |
| next-intl | i18n PT/EN |
| Supabase (PostgreSQL + Auth) | Base de dados + autenticação admin |
| Upstash Redis | Rate limiting |
| Brevo (Sendinblue) | Email transacional (QR + confirmações) |
| Vercel | Deploy + CDN |
| Sentry | Error tracking |

---

## Paleta de Cores (Goalfest)

Substituir tema QUIC (preto/roxo) pelo tema Goalfest (verde escuro/gold):

| Token | Hex | Uso |
|---|---|---|
| `--color-bg-primary` | `#0d1a0d` | Fundo principal |
| `--color-bg-surface` | `#163216` | Cards, superfícies |
| `--color-gold` | `#FFD700` | Destaque primário |
| `--color-red-pt` | `#C8102E` | CTAs urgentes |
| `--color-green-pt` | `#5ea63b` | Accent principal |
| `--color-text-primary` | `#F7FFF7` | Texto principal |
| `--color-text-muted` | `#a8d4a8` | Texto secundário |

Fundo fixo: `linear-gradient(160deg, #0d1a0d 0%, #112411 35%, #163216 65%, #1d4a1d 100%)`

---

## Tipografia

| Variável | Font | Uso |
|---|---|---|
| `--font-bebas` | Bebas Neue | Headings hero, navbar |
| `--font-display` | Oswald | Secções, títulos |
| `--font-sans` | Inter | Corpo de texto |
| `--font-dm-sans` | DM Sans | Formulários, UI |
| `--font-nav` | Orbitron | Navbar desktop |

---

## Arquitectura de Rotas

### Rotas Públicas (da fanzone website)

```
/[locale]/                    ← Landing (Hero + WhatIsGoalfest + Venue + Sponsors + FAQ)
/[locale]/jogos               ← Calendário de jogos completo
/[locale]/faq                 ← FAQ expandida
/[locale]/privacidade         ← Política de privacidade
/[locale]/termos              ← Termos e condições
```

### Rotas de Convidados VIP (do QUIC, adaptadas visualmente)

```
/i/[code]                     ← Página de convite VIP → formulário RSVP
/confirmado/[token]           ← Confirmação + QR após RSVP
```

### Rotas de Acreditação Media (do QUIC, adaptadas visualmente)

```
/a/[code]                     ← Página de acreditação pública
/acreditado/[token]           ← Confirmação acreditação + QR
```

### Rotas Admin (do QUIC, sem alterações visuais)

```
/admin/login                  ← Login admin
/admin/                       ← Dashboard (guests, checkin stats)
/admin/scan                   ← QR scanner (checkin + VIP mode)
/admin/invites                ← Gestão de convites VIP
/admin/acreditacoes           ← Gestão de acreditações media
/admin/audit                  ← Log de auditoria
/admin/account                ← Conta admin
```

### API Routes (do QUIC, inalteradas)

```
/api/rsvp                     ← Submissão RSVP
/api/qr/[token]               ← Imagem QR
/api/ics/[token]              ← Download ICS
/api/invites/[code]           ← Validação de convite
/api/a/[code]                 ← Info de link de acreditação
/api/accreditation-rsvp       ← Submissão acreditação
/api/admin/*                  ← Endpoints admin (checkin, export, etc.)
/api/cron/*                   ← Cron jobs (retry email)
/api/health                   ← Health check
```

---

## Componentes a Importar da Fanzone Website (sem alteração)

| Ficheiro | Origem |
|---|---|
| `src/components/sections/Hero.tsx` | fanzone website |
| `src/components/sections/WhatIsGoalfest.tsx` | fanzone website |
| `src/components/sections/Venue.tsx` | fanzone website |
| `src/components/sections/Sponsors.tsx` | fanzone website |
| `src/components/sections/FaqSection.tsx` | fanzone website |
| `src/components/sections/JogosSchedule.tsx` | fanzone website |
| `src/components/layout/Navbar.tsx` | fanzone website |
| `src/components/layout/Footer.tsx` | fanzone website |
| `src/components/ui/CountdownTimer.tsx` | fanzone website |
| `src/components/ui/MatchCard.tsx` | fanzone website |
| `src/components/ui/FaqAccordion.tsx` | fanzone website |
| `src/components/ui/BackgroundFX.tsx` | fanzone website |
| `src/components/ui/BackgroundFXClient.tsx` | fanzone website |
| `src/components/ui/VenueMap.tsx` | fanzone website |
| `src/components/ui/HashScroller.tsx` | fanzone website |
| `src/components/ui/ScrollToTop.tsx` | fanzone website |
| `src/data/schedule.ts` + `teamFlags.ts` | fanzone website |
| `src/i18n/` (routing, navigation, request) | fanzone website |
| `src/lib/matchFilters.ts`, `matchPhase.ts`, `countdown.ts` | fanzone website |

---

## Componentes QUIC a Redesenhar com Visual Goalfest

| Componente | O que muda |
|---|---|
| `src/components/invite-client.tsx` | Vídeo de fundo (mesmo `NEXT_PUBLIC_VIDEO_HERO` do Hero), paleta verde/gold |
| `src/components/rsvp-form.tsx` | Inputs DM Sans, cores Goalfest, botão verde |
| `src/components/confirmado-actions.tsx` | QR card com fundo `bg-surface` verde escuro, botão gold |
| `src/components/accreditation-client.tsx` | Vídeo de fundo igual ao Hero |
| `src/components/accreditation-form.tsx` | Paleta Goalfest |
| `src/components/acreditado-actions.tsx` | QR card Goalfest |
| `src/app/[locale]/layout.tsx` | Fonts Goalfest, `globals.css` fanzone |
| `src/app/globals.css` | Tema Goalfest completo (substituir tema QUIC) |

Admin (`src/components/admin/*`) mantém visual dark neutro — funcional, sem branding.

---

## Vídeo de Fundo

O vídeo `NEXT_PUBLIC_VIDEO_HERO` (env var) é reutilizado em:
- `Hero` (landing principal) — já existente na fanzone
- `invite-client` (página `/i/[code]`) — sobreposição escura 60% + conteúdo centrado
- `accreditation-client` (página `/a/[code]`) — mesmo tratamento

Comportamento: autoplay muted loop, pausado com `prefers-reduced-motion`, pausado quando tab escondida.

---

## i18n

- Manter sistema next-intl da fanzone website
- Ficheiros de mensagens: fusão de `pt.json`/`en.json` da fanzone + strings do QUIC (convite, RSVP, confirmação, acreditação)
- Locales: `pt` (default) e `en`
- Middleware: da fanzone website (exclui `/api/*`, `/admin/*`, `/i/*`, `/a/*`, `/confirmado/*`, `/acreditado/*`)

---

## Assets a Copiar da Fanzone Website

```
public/goalfest-logo.png
public/goalfest-logo2.png  (navbar)
public/quicnation-logo.png
public/patrocinadores/      (logos sponsors)
```

---

## Variáveis de Ambiente

União das env vars do QUIC + fanzone:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email (Brevo)
BREVO_API_KEY=
EMAIL_FROM=

# QR Token signing
QR_TOKEN_SECRET=

# Turnstile (Cloudflare anti-bot)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Vídeo hero
NEXT_PUBLIC_VIDEO_HERO=

# Mapbox (mapa venue)
NEXT_PUBLIC_MAPBOX_TOKEN=

# App
NEXT_PUBLIC_APP_URL=https://goalfest.pt
RSVP_OPEN=true

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

---

## Supabase / Migrações

Reutilizar **todas** as migrações do QUIC (0001–0016) na íntegra — schema idêntico. Criar novo projeto Supabase para o Goalfest e fazer `supabase db push`.

---

## Testes

- Copiar `tests/` do QUIC — cobrem API routes, componentes admin, lógica de negócio
- Copiar `src/lib/__tests__/` e `src/components/sections/*.test.tsx` da fanzone
- Vitest + React Testing Library (igual aos dois repos)
- Coverage thresholds do QUIC mantidos

---

## Deploy

- Vercel (novo projeto ligado ao repo Goalfest)
- Domínio: `goalfest.pt`
- Env vars configuradas no Vercel dashboard
- Supabase: novo projeto dedicado Goalfest
