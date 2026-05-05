-- Add VIP flag to invite_links so admins can create VIP-only invite links.
-- Guests created via a VIP invite automatically get is_vip = true.

alter table public.invite_links
  add column if not exists is_vip boolean not null default false;

-- Recreate claim_invite_seat to also return is_vip so the RSVP route can
-- set is_vip on the guest without a second query.
drop function if exists public.claim_invite_seat(text);
create function public.claim_invite_seat(p_code text)
returns table(ok boolean, invite_link_id uuid, reason text, is_vip boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_max      int;
  v_uses     int;
  v_expires  timestamptz;
  v_archived timestamptz;
  v_is_vip   boolean;
begin
  select id, max_uses, uses_count, expires_at, archived_at, invite_links.is_vip
    into v_id, v_max, v_uses, v_expires, v_archived, v_is_vip
  from public.invite_links
  where code = p_code
  for update;

  if v_id is null or v_archived is not null then
    return query select false, null::uuid, 'not-found'::text, false;
    return;
  end if;

  if v_expires is not null and v_expires < now() then
    return query select false, null::uuid, 'expired'::text, false;
    return;
  end if;

  if v_uses >= v_max then
    return query select false, null::uuid, 'exhausted'::text, false;
    return;
  end if;

  update public.invite_links
    set uses_count = uses_count + 1
    where id = v_id;

  return query select true, v_id, 'ok'::text, v_is_vip;
end$$;

revoke all on function public.claim_invite_seat(text) from public;
grant execute on function public.claim_invite_seat(text) to service_role;
