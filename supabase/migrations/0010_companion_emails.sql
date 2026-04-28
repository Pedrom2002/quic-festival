-- Add companion_emails column to guests table.
alter table public.guests
  add column if not exists companion_emails text[] not null default '{}';

-- Make companion_emails immutable via the existing guard trigger.
create or replace function public.guests_immutable_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      raise exception 'guests.name is immutable via UPDATE';
    end if;
    if new.email is distinct from old.email then
      raise exception 'guests.email is immutable via UPDATE';
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
    if new.companion_emails is distinct from old.companion_emails then
      raise exception 'guests.companion_emails is immutable via UPDATE';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'guests.created_at is immutable';
    end if;
  end if;
  return new;
end;
$$;
