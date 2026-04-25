# Contributing

## Local setup

```bash
cp .env.example .env.local   # fill keys (Supabase + Resend, optional Upstash + Turnstile)
npm install
npm run dev
```

## Before opening a PR

```bash
npm run verify   # lint + tsc --noEmit + vitest run --coverage (gate)
npm run e2e      # Playwright (optional locally; required in CI)
```

Coverage thresholds: 99 lines / 98 statements / 95 branches / 92 functions. Below this, CI fails.

## Commit style

`type(scope): subject` (imperative, lowercase, ≤72 chars). Examples:
- `feat(admin): paginate guests table`
- `sec(api): tighten CSP script-src in production`
- `fix(rate-limit): timeout Upstash REST after 800ms`

Do not add `Co-Authored-By: Claude` lines.

## Security-sensitive changes

Anything under `src/middleware.ts`, `src/lib/supabase/`, `src/app/api/admin/`, or `supabase/migrations/` requires a second pair of eyes per `CODEOWNERS`.

## New SQL changes

Add a numbered migration file in `supabase/migrations/`. Do not edit existing migrations after they have been applied to production.
