-- Activates pg_cron schedule that drives audit_log retention.
--
-- Pre-condition: extension `pg_cron` enabled on the project (Supabase
-- Dashboard → Database → Extensions). The job runs once a day at 04:00 UTC
-- and calls the existing `audit_log_purge(retain_days)` function from
-- 0002_hardening.sql.
--
-- Idempotent: drops + re-creates the schedule.

create extension if not exists pg_cron;

do $$
declare
  job_id bigint;
begin
  -- Remove agendamento existente, se houver.
  for job_id in select jobid from cron.job where jobname = 'audit_log_retention'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'audit_log_retention',
    '0 4 * * *',
    $cron$ select public.audit_log_purge(180); $cron$
  );
end$$;
