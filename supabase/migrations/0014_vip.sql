alter table public.guests
  add column if not exists is_vip boolean not null default false;
