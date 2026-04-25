-- Hardening migration: previously documented only in README, now reproducible.
-- Adds audit_log table, RLS deny-all on admins/audit_log, immutability triggers,
-- explicit guests INSERT/DELETE deny for non-service roles, retention helper.

-- ── audit_log table ──
create table if not exists public.audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_email text,
  action text not null,
  target_id uuid,
  ip text,
  meta jsonb
);

create index if not exists audit_log_occurred_idx on public.audit_log(occurred_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_email);
create index if not exists audit_log_action_idx on public.audit_log(action);

-- ── RLS deny-all for non-service roles ──
alter table public.admins enable row level security;
drop policy if exists admins_no_anon on public.admins;
create policy admins_no_anon on public.admins
  for all to anon, authenticated
  using (false) with check (false);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_no_anon on public.audit_log;
create policy audit_log_no_anon on public.audit_log
  for all to anon, authenticated
  using (false) with check (false);

-- ── audit_log immutability triggers ──
-- Even via service role we want UPDATE/DELETE to be impossible by accident.
create or replace function public.audit_log_no_update() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_update_trg on public.audit_log;
create trigger audit_log_no_update_trg
  before update or delete on public.audit_log
  for each row execute function public.audit_log_no_update();

-- ── Explicit guests INSERT/DELETE deny for authenticated/anon ──
-- Default deny is implicit when RLS is on, but make the intent explicit.
drop policy if exists guests_no_insert_anon on public.guests;
create policy guests_no_insert_anon on public.guests
  for insert to anon, authenticated
  with check (false);

drop policy if exists guests_no_delete_anon on public.guests;
create policy guests_no_delete_anon on public.guests
  for delete to anon, authenticated
  using (false);

-- ── Retention helper for RGPD ──
-- Schedule via Supabase cron (pg_cron) every day:
--   select cron.schedule('audit_log_retention', '0 4 * * *',
--     $$ delete from public.audit_log where occurred_at < now() - interval '180 days' $$);
-- Provided as a function to make the runbook explicit.
create or replace function public.audit_log_purge(retain_days int default 180)
returns int language plpgsql security definer as $$
declare
  n int;
begin
  -- bypass immutability trigger by disabling it for this txn
  alter table public.audit_log disable trigger audit_log_no_update_trg;
  delete from public.audit_log where occurred_at < now() - (retain_days || ' days')::interval;
  get diagnostics n = row_count;
  alter table public.audit_log enable trigger audit_log_no_update_trg;
  return n;
end;
$$;

revoke all on function public.audit_log_purge(int) from public;
-- service role keeps access via bypass.
