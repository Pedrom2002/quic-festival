-- Idempotency cache: per-(scope, key) cached response.
--
-- Used by /api/rsvp via the `Idempotency-Key` header. Stores a JSON response
-- + status code for 1 hour. Service-role only.

create table if not exists public.idempotency_keys (
  scope text not null,
  key text not null,
  response jsonb,
  status_code int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, key)
);

create index if not exists idempotency_keys_expires_idx
  on public.idempotency_keys(expires_at);

alter table public.idempotency_keys enable row level security;

drop policy if exists idempotency_keys_no_anon on public.idempotency_keys;
create policy idempotency_keys_no_anon on public.idempotency_keys
  for all to anon, authenticated
  using (false) with check (false);

-- Retention: drop > 24h. Keep the row for a while after expiry so that
-- collisions on the same key surface as duplicate-PK errors.
create or replace function public.idempotency_keys_purge()
returns int language plpgsql security definer as $$
declare n int;
begin
  delete from public.idempotency_keys where expires_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end$$;

revoke all on function public.idempotency_keys_purge() from public;
