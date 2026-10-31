-- Issue 17: the message transfer log was kept forever.
--
-- message_transfer_log records who messaged whom, when, and how big (no
-- content). Nothing in the app or the relay reads it, so keeping it forever
-- only builds up a permanent social-graph history. This migration keeps the
-- last 30 days and deletes the rest every day.
--
-- To change the retention, edit the number of days in the cron command below
-- (or call purge_old_message_transfer_log('7 days') by hand).

-- Lets the purge find old rows without scanning the whole table.
create index if not exists message_transfer_log_created_idx
  on public.message_transfer_log (created_at);

create or replace function public.purge_old_message_transfer_log(retain interval default interval '30 days')
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  if retain < interval '1 day' then
    raise exception 'retention must be at least 1 day';
  end if;
  delete from public.message_transfer_log where created_at < now() - retain;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the database owner / scheduler may run it, never app users.
revoke all on function public.purge_old_message_transfer_log(interval) from public, anon, authenticated;

-- Daily schedule at 03:15 UTC using pg_cron (Supabase: Database > Extensions >
-- pg_cron, or `create extension pg_cron with schema extensions;`). If pg_cron is
-- not enabled yet this prints a notice and the rest of the migration still
-- applies; enable it and re-run this file to add the schedule.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-message-transfer-log';
    perform cron.schedule(
      'purge-message-transfer-log',
      '15 3 * * *',
      $cron$select public.purge_old_message_transfer_log(interval '30 days')$cron$
    );
  else
    raise notice 'pg_cron is not available: the purge function is installed but NOT scheduled. Enable pg_cron and re-run this migration.';
  end if;
end $$;
