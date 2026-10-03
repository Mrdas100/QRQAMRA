\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create table test_clock(t timestamptz);
insert into test_clock values ('2026-10-03 12:00+03');
create or replace function _now() returns timestamptz language sql volatile as $$ select t from test_clock $$;
create or replace function at_(ts text) returns void language sql as $$ update test_clock set t = ts::timestamptz $$;

select create_admin('owner','supersecret1');
insert into shifts(name,start_time,end_time,break_minutes) values ('مسائي','16:00','02:00',40);
select admin_save_employee((select token from (select 1) x, lateral (select (admin_login('owner','supersecret1'))->>'token' token) t),
  '{"emp_no":"1004","name_ar":"محمد","name_bn":"মোহাম্মদ","pin":"1234","shift_id":"1"}'::jsonb);
update employees set created_at='2026-10-01 00:00+03';
\set adm `echo`
select (admin_login('owner','supersecret1'))->>'token' as admtok \gset

\echo '--- wrong pin x5 then rate limit'
select login('1004','0000','dev-aaaaaaaaaaaaaaaa')->>'error' from generate_series(1,6);
delete from login_attempts;
\echo '--- login ok + device bind'
select (login('1004','1234','dev-aaaaaaaaaaaaaaaa','test'))->>'token' as tok \gset
\echo '--- other device blocked'
select login('1004','1234','dev-bbbbbbbbbbbbbbbb')->>'error';

select at_('2026-10-03 16:05:20+03');
\echo '--- clock in 4:05 PM => late 5'
select clock_in(:'tok', 24.7136, 46.6753, 15)->'session';

select at_('2026-10-03 20:00:00+03');
select break_start(:'tok')->>'state';
select at_('2026-10-03 20:15:00+03');
\echo '--- admin live during break'
select jsonb_pretty(admin_live(:'admtok')->'counts');
\echo '--- notifications (expect pre10@20:30, pre5@20:35, end@20:40, over10@20:50, over20@21:00)'
select at_('2026-10-03 20:29:00+03'); select count(*) from due_break_notifications();
select at_('2026-10-03 20:30:10+03'); select kind||' '||minutes||' '||lang from due_break_notifications();
select at_('2026-10-03 20:31:00+03'); select count(*) from due_break_notifications();
select at_('2026-10-03 20:35:10+03'); select kind||' '||minutes from due_break_notifications();
select at_('2026-10-03 20:40:10+03'); select kind||' '||minutes from due_break_notifications();
select at_('2026-10-03 20:45:00+03'); select count(*) from due_break_notifications();
select at_('2026-10-03 20:50:10+03'); select kind||' '||minutes from due_break_notifications();
select at_('2026-10-03 21:00:10+03'); select kind||' '||minutes from due_break_notifications();

select at_('2026-10-03 21:10:00+03');
\echo '--- break end => 70 / 40 / 30'
select break_end(:'tok')->'result';

\echo '--- break limit (second break refused: expect error)'
\set ON_ERROR_STOP off
select break_start(:'tok');
\set ON_ERROR_STOP on

select at_('2026-10-04 02:00:00+03');
select clock_out(:'tok')->>'state';

select at_('2026-10-04 12:00:00+03');
select (admin_login('owner','supersecret1'))->>'token' as admtok \gset
\echo '--- monthly report'
select jsonb_pretty(admin_report(:'admtok','2026-10-01','2026-10-31')->'summary');
select jsonb_pretty(admin_report(:'admtok','2026-10-01','2026-10-31')->'days');
\echo '--- admin edit + audit'
select admin_edit_session(:'admtok',1,'{"clock_in":"2026-10-03 16:20+03"}'::jsonb);
select (admin_report(:'admtok','2026-10-03','2026-10-03')->'days'->0->>'late_min');
select action||' '||old_value::text||' => '||new_value::text from jsonb_to_recordset(admin_audit(:'admtok',5)) as x(action text, old_value jsonb, new_value jsonb) limit 1;
\echo '--- unauthorized'
do $$ begin perform admin_live('bad'); exception when others then raise notice 'expected: % (%)', sqlerrm, sqlstate; end $$;
\echo '--- unbind -> old token dead, new device ok'
select admin_unbind_device(:'admtok',1);
do $$ begin perform me('x'); exception when others then raise notice 'expected: %', sqlerrm; end $$;
select login('1004','1234','dev-bbbbbbbbbbbbbbbb')->>'token' is not null;
