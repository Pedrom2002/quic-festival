create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  role        text not null,
  phone       text,
  email       text not null,
  slug        text not null unique,
  active      boolean not null default true
);

create index if not exists team_members_active_idx on public.team_members(active);

alter table public.team_members enable row level security;

-- Public read: needed for /card/[slug] route (no auth required)
drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members
  for select to anon, authenticated
  using (true);

-- Admin write: insert/update/delete restricted to admins
drop policy if exists team_members_admin_write on public.team_members;
create policy team_members_admin_write on public.team_members
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
