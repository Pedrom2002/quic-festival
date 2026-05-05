create table if not exists public.accreditations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  media_company text not null,
  token uuid not null default gen_random_uuid() unique,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists accreditations_token_idx on public.accreditations(token);
create index if not exists accreditations_created_at_idx on public.accreditations(created_at desc);
create index if not exists accreditations_archived_idx on public.accreditations(archived_at);

alter table public.accreditations enable row level security;

drop policy if exists accreditations_admin_select on public.accreditations;
create policy accreditations_admin_select on public.accreditations
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists accreditations_no_anon on public.accreditations;
create policy accreditations_no_anon on public.accreditations
  for all to anon
  using (false) with check (false);
