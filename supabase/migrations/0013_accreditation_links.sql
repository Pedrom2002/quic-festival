-- Accreditation links — admin generates a code that allows up to N media
-- submissions. Counter updated atomically in claim_accreditation_seat().

create table if not exists public.accreditation_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  max_uses int not null check (max_uses > 0 and max_uses <= 1000),
  uses_count int not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists accreditation_links_code_idx on public.accreditation_links(code);
create index if not exists accreditation_links_archived_idx on public.accreditation_links(archived_at);

alter table public.accreditation_links enable row level security;

drop policy if exists accreditation_links_admin_select on public.accreditation_links;
create policy accreditation_links_admin_select on public.accreditation_links
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists accreditation_links_no_anon on public.accreditation_links;
create policy accreditation_links_no_anon on public.accreditation_links
  for all to anon
  using (false) with check (false);

-- FK from accreditations to accreditation_links
alter table public.accreditations
  add column if not exists accreditation_link_id uuid
    references public.accreditation_links(id) on delete set null;

create index if not exists accreditations_link_idx
  on public.accreditations(accreditation_link_id);

-- ── claim_accreditation_seat ──
create or replace function public.claim_accreditation_seat(p_code text)
returns table(ok boolean, accreditation_link_id uuid, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_max int;
  v_uses int;
  v_expires timestamptz;
  v_archived timestamptz;
begin
  select id, max_uses, uses_count, expires_at, archived_at
    into v_id, v_max, v_uses, v_expires, v_archived
  from public.accreditation_links
  where code = p_code
  for update;

  if v_id is null or v_archived is not null then
    return query select false, null::uuid, 'not-found'::text;
    return;
  end if;

  if v_expires is not null and v_expires < now() then
    return query select false, null::uuid, 'expired'::text;
    return;
  end if;

  if v_uses >= v_max then
    return query select false, null::uuid, 'exhausted'::text;
    return;
  end if;

  update public.accreditation_links
    set uses_count = uses_count + 1
    where id = v_id;

  return query select true, v_id, 'ok'::text;
end$$;

revoke all on function public.claim_accreditation_seat(text) from public;
grant execute on function public.claim_accreditation_seat(text) to service_role;
