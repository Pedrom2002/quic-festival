-- Email delivery failure tracking. Lets the cron retry job give up after N
-- attempts and lets the admin dashboard surface guests whose QR email never
-- went out (so a human can intervene before the festival).

alter table public.guests
  add column if not exists email_attempts int not null default 0,
  add column if not exists email_failed_at timestamptz,
  add column if not exists email_last_error text;

create index if not exists guests_email_failed_idx
  on public.guests(email_failed_at)
  where email_failed_at is not null;

-- Trigger 0003 protege colunas imutáveis. As novas colunas (email_attempts,
-- email_failed_at, email_last_error) NÃO estão no allowlist do trigger e
-- portanto são bloqueadas para writes do role authenticated. Mantemo-las
-- mutáveis apenas via service_role (que bypassa o trigger).
