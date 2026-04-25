-- Adds a `ics` text column to public.guests that caches the rendered .ics
-- payload built at insert time. Replaces the per-request render in
-- /api/ics/[token] (cheaper, deterministic; immutable-columns trigger from
-- 0003 already prevents the cached value being rewritten by admins).

alter table public.guests add column if not exists ics text;

-- Note: existing rows have ics = NULL. /api/ics/[token] falls back to live
-- render when the column is null, then back-fills via service role on the
-- next read. Migration is forward-compatible.

-- The immutable-columns trigger (0003) currently locks `ics` against
-- authenticated-role updates because it's not in the allowlist. service_role
-- bypasses RLS + triggers, so the back-fill from /api/ics still works.
