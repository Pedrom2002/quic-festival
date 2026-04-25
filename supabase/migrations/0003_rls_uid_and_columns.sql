-- Tightens RLS:
--   1. Move admin check from `auth.jwt() ->> 'email'` to `auth.uid()`.
--      Email is mutable in Supabase Auth; uid is not.
--   2. Restrict admin UPDATE on guests to {checked_in_at, email_sent_at}.
--      Mass-update via app or compromised session can no longer rewrite
--      name/email/token/created_at.
--
-- Backwards compatible: keeps the email column on `admins` for human-readable
-- audit refs, but adds `user_id` and uses it for policy checks. Old rows are
-- backfilled if a Supabase Auth user matches the email.

-- ── admins schema upgrade ──
alter table public.admins
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists admins_user_id_uniq on public.admins(user_id) where user_id is not null;

-- Backfill: para cada admin email-only, tenta encontrar o user em auth.users
-- e materializa o user_id. Idempotente.
update public.admins a
set user_id = u.id
from auth.users u
where a.user_id is null
  and lower(a.email) = lower(u.email);

-- Helper: is_admin(uid). SECURITY DEFINER para que possa ser chamada nas
-- policies sem expor a tabela admins ao role authenticated.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = uid
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- ── Substituir policies email-based por uid-based ──
drop policy if exists "admin_select" on public.guests;
drop policy if exists "admin_update" on public.guests;

create policy "admin_select" on public.guests
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- UPDATE permitido apenas se o user é admin E os únicos campos alterados são
-- {checked_in_at, email_sent_at}. Postgres não tem "column-level WITH CHECK"
-- nativo, então o truque é: na cláusula USING garantimos admin; no WITH CHECK
-- garantimos que os campos sensíveis ficam iguais à row antiga.
--
-- Para isso usamos um trigger BEFORE UPDATE (mais robusto que tentar codificar
-- isto em policy expressions, que não veem a row antiga).
create policy "admin_update" on public.guests
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Trigger: apenas {checked_in_at, email_sent_at} podem mudar via UPDATE
-- vindo de roles authenticated. service_role bypassa RLS e este trigger.
create or replace function public.guests_protect_immutable_columns()
returns trigger
language plpgsql as $$
begin
  -- Apenas aplicar a mutation guard se o caller é authenticated (não service_role).
  -- service_role está isento — usado pelas API routes para inserts/deletes.
  if (current_setting('request.jwt.claims', true) is not null
      and (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated') then
    if new.id is distinct from old.id then
      raise exception 'guests.id is immutable';
    end if;
    if new.email is distinct from old.email then
      raise exception 'guests.email is immutable via UPDATE';
    end if;
    if new.name is distinct from old.name then
      raise exception 'guests.name is immutable via UPDATE';
    end if;
    if new.phone is distinct from old.phone then
      raise exception 'guests.phone is immutable via UPDATE';
    end if;
    if new.token is distinct from old.token then
      raise exception 'guests.token is immutable via UPDATE';
    end if;
    if new.companion_count is distinct from old.companion_count then
      raise exception 'guests.companion_count is immutable via UPDATE';
    end if;
    if new.companion_names is distinct from old.companion_names then
      raise exception 'guests.companion_names is immutable via UPDATE';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'guests.created_at is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guests_protect_immutable_columns_trg on public.guests;
create trigger guests_protect_immutable_columns_trg
  before update on public.guests
  for each row execute function public.guests_protect_immutable_columns();

-- audit_log policy: já existe deny-all em 0002. Inserts continuam só via
-- service_role. Nenhuma alteração necessária aqui.
