-- شغّله بعد نشر دالة notify. استبدل REF و SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('break-notify', '* * * * *', $$
  select net.http_post(
    url := 'https://REF.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','SECRET'),
    body := '{}'::jsonb) $$);
-- لإيقافه:  select cron.unschedule('break-notify');
