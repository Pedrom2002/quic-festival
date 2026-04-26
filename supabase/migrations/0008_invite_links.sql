-- Invite links system. Admin generates a code that allows up to N RSVP
-- submissions; counter is updated atomically in `claim_invite_seat()`.
--
-- Public flow:
--   GET /i/<code> renders the RSVP form pre-tagged with the code.
--   POST /api/rsvp { ...form, inviteCode } calls claim_invite_seat() in a
--   transaction, fails fast if the seat is taken.

create table if not exists public.invite_links (
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

create index if not exists invite_links_code_idx on public.invite_links(code);
create index if not exists invite_links_archived_idx on public.invite_links(archived_at);

alter table public.invite_links enable row level security;

drop policy if exists invite_links_admin_select on public.invite_links;
create policy invite_links_admin_select on public.invite_links
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists invite_links_no_anon on public.invite_links;
create policy invite_links_no_anon on public.invite_links
  for all to anon
  using (false) with check (false);

-- ── guests.invite_link_id (nullable, audit) ──
alter table public.guests
  add column if not exists invite_link_id uuid references public.invite_links(id) on delete set null;

create index if not exists guests_invite_link_idx on public.guests(invite_link_id);

-- Trigger 0003 já bloqueia mutations por authenticated em colunas sensíveis.
-- invite_link_id é só populado via service_role no insert.

-- ── claim_invite_seat ──
-- Devolve { ok bool, invite_link_id uuid, reason text }. Reasons:
--   "not-found"   código inexistente / arquivado.
--   "expired"     expires_at no passado.
--   "exhausted"   max_uses atingido.
--   "ok"          incrementou e devolve invite_link_id.
--
-- SECURITY DEFINER porque o caller é o role anónimo via API; a validação +
-- escrita são contidas e rate-limited externamente.

create or replace function public.claim_invite_seat(p_code text)
returns table(ok boolean, invite_link_id uuid, reason text)
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
  -- Lock row to serialize concurrent claims for the same code.
  select id, max_uses, uses_count, expires_at, archived_at
    into v_id, v_max, v_uses, v_expires, v_archived
  from public.invite_links
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

  update public.invite_links
    set uses_count = uses_count + 1
    where id = v_id;

  return query select true, v_id, 'ok'::text;
end$$;

revoke all on function public.claim_invite_seat(text) from public;
grant execute on function public.claim_invite_seat(text) to service_role;

-- Helper para release de seat se insert do guest falhar after claim. Uso
-- raro (race idempotency / dedup). Não-transaccional perfeito mas suficiente
-- para evitar gastar seats em falhas ocasionais.
create or replace function public.release_invite_seat(p_invite_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invite_links
    set uses_count = greatest(0, uses_count - 1)
    where id = p_invite_link_id;
end$$;

revoke all on function public.release_invite_seat(uuid) from public;
grant execute on function public.release_invite_seat(uuid) to service_role;
