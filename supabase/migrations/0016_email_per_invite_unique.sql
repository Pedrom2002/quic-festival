-- Allow the same email across different invite links.
-- Previously: email was globally unique (one registration per email ever).
-- Now: unique per (email, invite_link_id) — same email can register via
-- different invite links, but cannot register twice on the same link.
--
-- Guests with no invite_link_id (public registrations, if any) keep their
-- existing behaviour via the partial unique index below.

-- 1. Drop the old global unique constraint on email.
alter table public.guests drop constraint if exists guests_email_key;

-- 2. Unique per (email, invite_link_id) — covers invited guests.
--    NULLS NOT DISTINCT requires Postgres 15+; Supabase runs PG15+.
create unique index if not exists guests_email_invite_link_uniq
  on public.guests (email, invite_link_id)
  nulls not distinct;
