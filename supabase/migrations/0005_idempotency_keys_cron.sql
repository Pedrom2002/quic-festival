-- Schedules pg_cron job that purges expired idempotency_keys rows hourly.
--
-- Pre-condition: pg_cron extension enabled (see 0006). 0006 also enables
-- the extension via `create extension if not exists`, but this migration is
-- ordered earlier so that the dependency is explicit when applied to a
-- fresh project where 0006 has not yet been touched.

create extension if not exists pg_cron;

do $$
declare
  job_id bigint;
begin
  for job_id in select jobid from cron.job where jobname = 'idempotency_keys_purge'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'idempotency_keys_purge',
    '17 * * * *',
    $cron$ select public.idempotency_keys_purge(); $cron$
  );
end$$;
