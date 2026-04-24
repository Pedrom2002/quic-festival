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

create policy "admin_select" on public.guests
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.admins));

create policy "admin_update" on public.guests
  for update to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.admins))
  with check (auth.jwt() ->> 'email' in (select email from public.admins));
