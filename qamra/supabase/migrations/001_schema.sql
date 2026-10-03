-- دوام شاهي قمرا — Schema + business logic (all logic runs in the DB, time = server time, Asia/Riyadh)
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function _now() returns timestamptz language sql stable as $$ select now() $$;

-- ───────── Tables ─────────
create table if not exists app_settings(key text primary key, value text not null);
insert into app_settings(key,value) values ('max_breaks','1'),('default_break_min','40'),('radius_m','150') on conflict do nothing;

create table if not exists shifts(
  id serial primary key, name text not null,
  start_time time not null, end_time time not null,
  break_minutes int not null default 40 check (break_minutes between 1 and 240),
  active boolean not null default true);

create table if not exists employees(
  id serial primary key,
  emp_no text not null unique check (emp_no ~ '^[a-z0-9]{2,12}$'),
  name_ar text not null, name_bn text,
  pin_hash text not null,
  lang text not null default 'ar' check (lang in ('ar','bn')),
  shift_id int references shifts(id),
  weekly_off smallint check (weekly_off between 0 and 6),   -- 0=الأحد
  active boolean not null default true,
  created_at timestamptz not null default now());

create table if not exists devices(
  id bigserial primary key,
  employee_id int not null references employees(id) on delete cascade,
  device_key text not null, user_agent text,
  bound_at timestamptz not null default now(), revoked_at timestamptz);
create unique index if not exists devices_one_active on devices(employee_id) where revoked_at is null;

create table if not exists admin_users(
  id serial primary key, username text not null unique, pass_hash text not null, active boolean not null default true);

create table if not exists sessions(
  token_hash text primary key, role text not null check (role in ('employee','admin')),
  employee_id int references employees(id) on delete cascade,
  admin_id int references admin_users(id) on delete cascade,
  device_id bigint, expires_at timestamptz not null, created_at timestamptz not null default now());

create table if not exists work_sessions(
  id bigserial primary key, employee_id int not null references employees(id),
  work_date date not null, shift_start time, shift_end time, break_allowed int not null,
  clock_in timestamptz not null, clock_out timestamptz,
  late_min int not null default 0, early_min int not null default 0, auto_closed boolean not null default false);
create unique index if not exists ws_one_open on work_sessions(employee_id) where clock_out is null;
create index if not exists ws_emp_date on work_sessions(employee_id, work_date);

create table if not exists breaks(
  id bigserial primary key, session_id bigint not null references work_sessions(id) on delete cascade,
  employee_id int not null references employees(id),
  start_at timestamptz not null, end_at timestamptz, allowed_min int not null,
  notified_pre1 boolean not null default false, notified_pre2 boolean not null default false,
  notified_end boolean not null default false, over_notified int not null default 0);
create unique index if not exists breaks_one_open on breaks(session_id) where end_at is null;

create table if not exists attendance_events(
  id bigserial primary key, employee_id int not null references employees(id),
  session_id bigint references work_sessions(id) on delete set null,
  event_type text not null check (event_type in ('CLOCK_IN','BREAK_START','BREAK_END','CLOCK_OUT')),
  server_time timestamptz not null, latitude float8, longitude float8, accuracy float8,
  in_geofence boolean, device_id bigint);
create index if not exists ev_emp_time on attendance_events(employee_id, server_time);

create table if not exists push_subscriptions(
  id bigserial primary key, employee_id int not null references employees(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null, created_at timestamptz not null default now());

create table if not exists audit_logs(
  id bigserial primary key, admin_id int references admin_users(id), action text not null,
  target_type text, target_id text, old_value jsonb, new_value jsonb, at timestamptz not null default now());

create table if not exists login_attempts(id bigserial primary key, key text not null, ok boolean not null, at timestamptz not null);
create index if not exists la_key on login_attempts(key, at);

-- Lock every table: access only through the functions below
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public, anon, authenticated', t);
  end loop; end $$;

-- ───────── Helpers ─────────
create or replace function _setting(k text, d text) returns text language sql stable as
$$ select coalesce((select value from app_settings where key=k), d) $$;
create or replace function _max_breaks() returns int language sql stable as $$ select _setting('max_breaks','1')::int $$;

create or replace function _emp(p_token text) returns employees language plpgsql as $$
declare s sessions; e employees;
begin
  select * into s from sessions where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
     and role='employee' and expires_at>_now();
  if not found then raise exception 'unauthorized' using errcode='PT401'; end if;
  select * into e from employees where id=s.employee_id and active;
  if not found then raise exception 'unauthorized' using errcode='PT401'; end if;
  if not exists(select 1 from devices where id=s.device_id and revoked_at is null) then
    raise exception 'unauthorized' using errcode='PT401'; end if;
  return e;
end $$;

create or replace function _admin(p_token text) returns admin_users language plpgsql as $$
declare s sessions; a admin_users;
begin
  select * into s from sessions where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
     and role='admin' and expires_at>_now();
  if not found then raise exception 'unauthorized' using errcode='PT401'; end if;
  select * into a from admin_users where id=s.admin_id and active;
  if not found then raise exception 'unauthorized' using errcode='PT401'; end if;
  return a;
end $$;

create or replace function _audit(p_admin int, p_action text, p_type text, p_id text, p_old jsonb, p_new jsonb)
returns void language sql as $$
  insert into audit_logs(admin_id,action,target_type,target_id,old_value,new_value,at)
  values (p_admin,p_action,p_type,p_id,p_old,p_new,_now()) $$;

create or replace function _geo(p_lat float8, p_lng float8) returns boolean language plpgsql stable as $$
declare la float8; lo float8; r float8; d float8;
begin
  if p_lat is null or p_lng is null then return null; end if;
  la := _setting('shop_lat',null)::float8; lo := _setting('shop_lng',null)::float8;
  if la is null or lo is null then return null; end if;
  r := _setting('radius_m','150')::float8;
  d := 6371000*2*asin(least(1,sqrt(sin(radians(p_lat-la)/2)^2 + cos(radians(la))*cos(radians(p_lat))*sin(radians(p_lng-lo)/2)^2)));
  return d <= r;
end $$;

create or replace function _event(e employees, p_sess bigint, p_type text, p_lat float8, p_lng float8, p_acc float8)
returns void language plpgsql as $$
declare la float8 := p_lat; lo float8 := p_lng; ac float8 := p_acc;
begin
  if la is null or lo is null or abs(la)>90 or abs(lo)>180 then la:=null; lo:=null; ac:=null; end if;
  if ac is not null and ac<0 then ac:=null; end if;
  insert into attendance_events(employee_id,session_id,event_type,server_time,latitude,longitude,accuracy,in_geofence,device_id)
  values (e.id,p_sess,p_type,_now(),la,lo,ac,_geo(la,lo),(select id from devices where employee_id=e.id and revoked_at is null));
end $$;

create or replace function _sched_end(p_date date, p_start time, p_end time) returns timestamptz language sql immutable as $$
  select case when p_start is null then null
    else ((p_date + p_end) + case when p_end <= p_start then interval '1 day' else interval '0' end) at time zone 'Asia/Riyadh' end $$;

-- forgotten clock-outs (> 16h) are closed automatically and flagged
create or replace function _close_stale(p_emp int) returns void language plpgsql as $$
declare r record; o timestamptz;
begin
  for r in select id, clock_in from work_sessions where clock_out is null and clock_in < _now()-interval '16 hours'
           and (p_emp is null or employee_id=p_emp) loop
    o := r.clock_in + interval '12 hours';
    update breaks set end_at=greatest(start_at,o) where session_id=r.id and end_at is null;
    update work_sessions set clock_out=o, auto_closed=true where id=r.id;
  end loop;
end $$;

create or replace function _status(e employees) returns jsonb language plpgsql stable as $$
declare w work_sessions; b breaks; st text := 'off'; nb int := 0;
begin
  select * into w from work_sessions where employee_id=e.id and clock_out is null;
  if found then
    st := 'working';
    select * into b from breaks where session_id=w.id and end_at is null;
    if found then st := 'break'; end if;
    select count(*) into nb from breaks where session_id=w.id;
  end if;
  return jsonb_build_object('now',_now(),'state',st,
    'employee',jsonb_build_object('id',e.id,'emp_no',e.emp_no,'name_ar',e.name_ar,'name_bn',e.name_bn,'lang',e.lang),
    'shift',(select jsonb_build_object('name',s.name,'start',s.start_time,'end',s.end_time,'break',s.break_minutes) from shifts s where s.id=e.shift_id),
    'session',case when w.id is null then null else jsonb_build_object('clock_in',w.clock_in,'late_min',w.late_min,'break_allowed',w.break_allowed) end,
    'break',case when b.id is null then null else jsonb_build_object('start_at',b.start_at,'allowed_min',b.allowed_min) end,
    'breaks_used',nb,'breaks_max',_max_breaks());
end $$;

-- ───────── Employee API ─────────
create or replace function login(p_emp text, p_pin text, p_device text, p_ua text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees; d devices; tok text; ip text; k text; fails int; ipfails int;
begin
  p_emp := lower(trim(coalesce(p_emp,'')));
  if length(p_emp)>20 or length(coalesce(p_device,''))<16 or length(p_device)>100 then
    return jsonb_build_object('error','invalid_credentials'); end if;
  ip := coalesce(split_part(coalesce(nullif(current_setting('request.headers',true),''),'{}')::json->>'x-forwarded-for',',',1),'?');
  k := 'emp:'||p_emp;
  delete from login_attempts where at < _now()-interval '1 day';
  select count(*) into fails from login_attempts where key=k and not ok and at>_now()-interval '15 minutes';
  select count(*) into ipfails from login_attempts where key='ip:'||ip and not ok and at>_now()-interval '15 minutes';
  if fails>=5 or ipfails>=30 then return jsonb_build_object('error','rate_limited'); end if;
  select * into e from employees where emp_no=p_emp and active;
  if not found or e.pin_hash <> crypt(coalesce(p_pin,''), e.pin_hash) then
    insert into login_attempts(key,ok,at) values (k,false,_now()),('ip:'||ip,false,_now());
    return jsonb_build_object('error','invalid_credentials');
  end if;
  select * into d from devices where employee_id=e.id and revoked_at is null;
  if not found then
    insert into devices(employee_id,device_key,user_agent,bound_at) values (e.id,p_device,left(p_ua,300),_now()) returning * into d;
  elsif d.device_key <> p_device then
    return jsonb_build_object('error','device_mismatch');
  end if;
  tok := encode(gen_random_bytes(32),'hex');
  insert into sessions(token_hash,role,employee_id,device_id,expires_at)
  values (encode(digest(tok,'sha256'),'hex'),'employee',e.id,d.id,_now()+interval '90 days');
  return jsonb_build_object('token',tok) || _status(e);
end $$;

create or replace function me(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees;
begin e := _emp(p_token); perform _close_stale(e.id); return _status(e); end $$;

create or replace function set_lang(p_token text, p_lang text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees;
begin
  e := _emp(p_token);
  if p_lang not in ('ar','bn') then raise exception 'bad_lang' using errcode='PT400'; end if;
  update employees set lang=p_lang where id=e.id; return jsonb_build_object('ok',true);
end $$;

create or replace function logout(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
  delete from sessions where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
  return jsonb_build_object('ok',true);
end $$;

create or replace function clock_in(p_token text, p_lat float8 default null, p_lng float8 default null, p_acc float8 default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees; sh shifts; wd date; sched timestamptz; late int := 0; t timestamptz := _now(); sid bigint;
begin
  e := _emp(p_token);
  perform 1 from employees where id=e.id for update;
  perform _close_stale(e.id);
  if exists(select 1 from work_sessions where employee_id=e.id and clock_out is null) then
    raise exception 'already_clocked_in' using errcode='PT409'; end if;
  select * into sh from shifts where id=e.shift_id;
  wd := (t at time zone 'Asia/Riyadh')::date;
  if sh.id is not null then
    sched := (wd + sh.start_time) at time zone 'Asia/Riyadh';
    late := greatest(0, floor(extract(epoch from t - sched)/60))::int;
  end if;
  insert into work_sessions(employee_id,work_date,shift_start,shift_end,break_allowed,clock_in,late_min)
  values (e.id,wd,sh.start_time,sh.end_time,coalesce(sh.break_minutes,_setting('default_break_min','40')::int),t,late)
  returning id into sid;
  perform _event(e,sid,'CLOCK_IN',p_lat,p_lng,p_acc);
  return _status(e);
end $$;

create or replace function break_start(p_token text, p_lat float8 default null, p_lng float8 default null, p_acc float8 default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees; w work_sessions;
begin
  e := _emp(p_token);
  perform 1 from employees where id=e.id for update;
  select * into w from work_sessions where employee_id=e.id and clock_out is null;
  if not found then raise exception 'not_clocked_in' using errcode='PT409'; end if;
  if exists(select 1 from breaks where session_id=w.id and end_at is null) then raise exception 'already_on_break' using errcode='PT409'; end if;
  if (select count(*) from breaks where session_id=w.id) >= _max_breaks() then raise exception 'break_limit' using errcode='PT409'; end if;
  insert into breaks(session_id,employee_id,start_at,allowed_min) values (w.id,e.id,_now(),w.break_allowed);
  perform _event(e,w.id,'BREAK_START',p_lat,p_lng,p_acc);
  return _status(e);
end $$;

create or replace function break_end(p_token text, p_lat float8 default null, p_lng float8 default null, p_acc float8 default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees; w work_sessions; b breaks; dur int;
begin
  e := _emp(p_token);
  perform 1 from employees where id=e.id for update;
  select * into w from work_sessions where employee_id=e.id and clock_out is null;
  if not found then raise exception 'not_clocked_in' using errcode='PT409'; end if;
  update breaks set end_at=_now() where session_id=w.id and end_at is null returning * into b;
  if not found then raise exception 'not_on_break' using errcode='PT409'; end if;
  perform _event(e,w.id,'BREAK_END',p_lat,p_lng,p_acc);
  dur := floor(extract(epoch from b.end_at-b.start_at)/60)::int;
  return _status(e) || jsonb_build_object('result',jsonb_build_object('break_min',dur,'allowed_min',b.allowed_min,'over_min',greatest(0,dur-b.allowed_min)));
end $$;

create or replace function clock_out(p_token text, p_lat float8 default null, p_lng float8 default null, p_acc float8 default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees; w work_sessions; t timestamptz := _now(); se timestamptz; early int := 0;
begin
  e := _emp(p_token);
  perform 1 from employees where id=e.id for update;
  select * into w from work_sessions where employee_id=e.id and clock_out is null;
  if not found then raise exception 'not_clocked_in' using errcode='PT409'; end if;
  if exists(select 1 from breaks where session_id=w.id and end_at is null) then
    update breaks set end_at=t where session_id=w.id and end_at is null;
    perform _event(e,w.id,'BREAK_END',p_lat,p_lng,p_acc);
  end if;
  se := _sched_end(w.work_date,w.shift_start,w.shift_end);
  if se is not null then early := greatest(0, floor(extract(epoch from se - t)/60))::int; end if;
  update work_sessions set clock_out=t, early_min=early where id=w.id;
  perform _event(e,w.id,'CLOCK_OUT',p_lat,p_lng,p_acc);
  return _status(e);
end $$;

create or replace function save_push(p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e employees;
begin
  e := _emp(p_token);
  if length(coalesce(p_endpoint,''))<20 or length(p_endpoint)>1000 then raise exception 'bad_input' using errcode='PT400'; end if;
  insert into push_subscriptions(employee_id,endpoint,p256dh,auth) values (e.id,p_endpoint,p_p256dh,p_auth)
  on conflict (endpoint) do update set employee_id=e.id,p256dh=excluded.p256dh,auth=excluded.auth;
  return jsonb_build_object('ok',true);
end $$;

-- ───────── Notifications (service role only) ─────────
create or replace function due_break_notifications()
returns table(employee_id int, lang text, kind text, minutes int, subs jsonb)
language plpgsql security definer set search_path=public,extensions as $$
declare r record; el int; ov int; k text; mins int;
begin
  for r in select b.id bid, b.employee_id eid, b.start_at, b.allowed_min a, b.notified_pre1 n1, b.notified_pre2 n2,
                  b.notified_end ne, b.over_notified ovn, e.lang elang
           from breaks b join employees e on e.id=b.employee_id where b.end_at is null for update of b loop
    el := floor(extract(epoch from _now()-r.start_at)/60)::int; k := null; mins := 0;
    if el >= r.a then
      if not r.ne then
        k := 'end'; update breaks set notified_end=true, notified_pre1=true, notified_pre2=true where id=r.bid;
      else
        ov := (floor((el-r.a)/10.0)*10)::int;
        if ov > r.ovn then k := 'over'; mins := ov; update breaks set over_notified=ov where id=r.bid; end if;
      end if;
    elsif el >= r.a-5 and not r.n2 then
      k := 'pre5'; update breaks set notified_pre2=true, notified_pre1=true where id=r.bid;
    elsif el >= r.a-10 and not r.n1 then
      k := 'pre10'; update breaks set notified_pre1=true where id=r.bid;
    end if;
    if k is not null then
      return query select r.eid, r.elang, k, mins,
        coalesce((select jsonb_agg(jsonb_build_object('endpoint',ps.endpoint,'p256dh',ps.p256dh,'auth',ps.auth))
                  from push_subscriptions ps where ps.employee_id=r.eid),'[]'::jsonb);
    end if;
  end loop;
end $$;

create or replace function drop_push(p_endpoint text) returns void language sql security definer set search_path=public as
$$ delete from push_subscriptions where endpoint=p_endpoint $$;

-- ───────── Admin API ─────────
create or replace function create_admin(p_user text, p_pass text) returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  if length(coalesce(p_pass,''))<8 then raise exception 'password must be at least 8 chars'; end if;
  insert into admin_users(username,pass_hash) values (lower(trim(p_user)), crypt(p_pass, gen_salt('bf',10)))
  on conflict (username) do update set pass_hash=excluded.pass_hash, active=true;
end $$;

create or replace function admin_login(p_user text, p_pass text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; tok text; k text; fails int; ip text;
begin
  p_user := lower(trim(coalesce(p_user,'')));
  ip := coalesce(split_part(coalesce(nullif(current_setting('request.headers',true),''),'{}')::json->>'x-forwarded-for',',',1),'?');
  k := 'admin:'||p_user;
  select count(*) into fails from login_attempts where key in (k,'ip:'||ip) and not ok and at>_now()-interval '15 minutes';
  if fails>=8 then return jsonb_build_object('error','rate_limited'); end if;
  select * into a from admin_users where username=p_user and active;
  if not found or a.pass_hash <> crypt(coalesce(p_pass,''), a.pass_hash) then
    insert into login_attempts(key,ok,at) values (k,false,_now()),('ip:'||ip,false,_now());
    return jsonb_build_object('error','invalid_credentials');
  end if;
  tok := encode(gen_random_bytes(32),'hex');
  insert into sessions(token_hash,role,admin_id,expires_at) values (encode(digest(tok,'sha256'),'hex'),'admin',a.id,_now()+interval '12 hours');
  return jsonb_build_object('token',tok,'username',a.username);
end $$;

create or replace function admin_live(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; res jsonb;
begin
  a := _admin(p_token); perform _close_stale(null);
  with x as (
    select e.id, e.emp_no, e.name_ar, e.name_bn, w.clock_in, w.late_min, b.start_at as break_start,
      coalesce(b.allowed_min,w.break_allowed) as allowed,
      case when w.id is null then 'off' when b.id is null then 'working' else 'break' end as st,
      (select ev.in_geofence from attendance_events ev where ev.session_id=w.id and ev.event_type='CLOCK_IN' order by ev.id limit 1) as geo
    from employees e left join work_sessions w on w.employee_id=e.id and w.clock_out is null
    left join breaks b on b.session_id=w.id and b.end_at is null where e.active)
  select jsonb_build_object('now',_now(),
    'counts',jsonb_build_object('total',count(*),'working',count(*) filter (where st='working'),
       'break',count(*) filter (where st='break'),'off',count(*) filter (where st='off'),
       'overrun',count(*) filter (where st='break' and _now()-break_start > allowed*interval '1 minute')),
    'employees',coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)) into res from x;
  return res;
end $$;

create or replace function admin_list_employees(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin
  a := _admin(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'emp_no',e.emp_no,'name_ar',e.name_ar,'name_bn',e.name_bn,
    'lang',e.lang,'shift_id',e.shift_id,'weekly_off',e.weekly_off,'active',e.active,
    'device_bound',d.id is not null,'device_since',d.bound_at,'device_ua',d.user_agent) order by e.active desc, e.id)
    from employees e left join devices d on d.employee_id=e.id and d.revoked_at is null),'[]'::jsonb);
end $$;

create or replace function admin_save_employee(p_token text, p jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; v_no text; old employees; r employees; v_pin text := p->>'pin';
begin
  a := _admin(p_token);
  v_no := lower(trim(coalesce(p->>'emp_no','')));
  if v_no !~ '^[a-z0-9]{2,12}$' then raise exception 'bad_emp_no' using errcode='PT400'; end if;
  if length(trim(coalesce(p->>'name_ar','')))<1 or length(p->>'name_ar')>60 or length(coalesce(p->>'name_bn',''))>60 then
    raise exception 'bad_name' using errcode='PT400'; end if;
  begin
    if nullif(p->>'id','') is null then
      if v_pin is null or v_pin !~ '^[0-9]{4,6}$' then raise exception 'bad_pin' using errcode='PT400'; end if;
      insert into employees(emp_no,name_ar,name_bn,pin_hash,shift_id,weekly_off)
      values (v_no,trim(p->>'name_ar'),nullif(trim(coalesce(p->>'name_bn','')),''),crypt(v_pin,gen_salt('bf',8)),
              nullif(p->>'shift_id','')::int,nullif(p->>'weekly_off','')::smallint) returning * into r;
      perform _audit(a.id,'employee_create','employee',r.id::text,null,to_jsonb(r)-'pin_hash');
    else
      select * into old from employees where id=(p->>'id')::int;
      if not found then raise exception 'not_found' using errcode='PT404'; end if;
      update employees set emp_no=v_no,name_ar=trim(p->>'name_ar'),name_bn=nullif(trim(coalesce(p->>'name_bn','')),''),
        shift_id=nullif(p->>'shift_id','')::int,weekly_off=nullif(p->>'weekly_off','')::smallint where id=old.id returning * into r;
      perform _audit(a.id,'employee_update','employee',r.id::text,to_jsonb(old)-'pin_hash',to_jsonb(r)-'pin_hash');
    end if;
  exception when unique_violation then raise exception 'emp_no_exists' using errcode='PT409';
  end;
  return jsonb_build_object('id',r.id);
end $$;

create or replace function admin_set_pin(p_token text, p_id int, p_pin text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then raise exception 'bad_pin' using errcode='PT400'; end if;
  update employees set pin_hash=crypt(p_pin,gen_salt('bf',8)) where id=p_id;
  if not found then raise exception 'not_found' using errcode='PT404'; end if;
  delete from sessions where employee_id=p_id;
  perform _audit(a.id,'pin_change','employee',p_id::text,null,null);
  return jsonb_build_object('ok',true);
end $$;

create or replace function admin_unbind_device(p_token text, p_id int) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin
  a := _admin(p_token);
  update devices set revoked_at=_now() where employee_id=p_id and revoked_at is null;
  delete from sessions where employee_id=p_id;
  perform _audit(a.id,'device_unbind','employee',p_id::text,null,null);
  return jsonb_build_object('ok',true);
end $$;

create or replace function admin_set_active(p_token text, p_id int, p_active boolean) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; old boolean;
begin
  a := _admin(p_token);
  select active into old from employees where id=p_id;
  if not found then raise exception 'not_found' using errcode='PT404'; end if;
  update employees set active=p_active where id=p_id;
  if not p_active then delete from sessions where employee_id=p_id; end if;
  perform _audit(a.id,'employee_active','employee',p_id::text,jsonb_build_object('active',old),jsonb_build_object('active',p_active));
  return jsonb_build_object('ok',true);
end $$;

create or replace function admin_list_shifts(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin a := _admin(p_token);
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from shifts s),'[]'::jsonb); end $$;

create or replace function admin_save_shift(p_token text, p jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; old shifts; r shifts;
begin
  a := _admin(p_token);
  if length(trim(coalesce(p->>'name','')))<1 then raise exception 'bad_name' using errcode='PT400'; end if;
  if nullif(p->>'id','') is null then
    insert into shifts(name,start_time,end_time,break_minutes) values (trim(p->>'name'),(p->>'start_time')::time,(p->>'end_time')::time,(p->>'break_minutes')::int) returning * into r;
    perform _audit(a.id,'shift_create','shift',r.id::text,null,to_jsonb(r));
  else
    select * into old from shifts where id=(p->>'id')::int;
    if not found then raise exception 'not_found' using errcode='PT404'; end if;
    update shifts set name=trim(p->>'name'),start_time=(p->>'start_time')::time,end_time=(p->>'end_time')::time,break_minutes=(p->>'break_minutes')::int where id=old.id returning * into r;
    perform _audit(a.id,'shift_update','shift',r.id::text,to_jsonb(old),to_jsonb(r));
  end if;
  return jsonb_build_object('id',r.id);
end $$;

create or replace function admin_get_settings(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin a := _admin(p_token);
  return coalesce((select jsonb_object_agg(key,value) from app_settings),'{}'::jsonb); end $$;

create or replace function admin_save_settings(p_token text, p jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; k text; old jsonb;
begin
  a := _admin(p_token);
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into old from app_settings;
  foreach k in array array['shop_lat','shop_lng','radius_m','max_breaks'] loop
    if p ? k then
      if nullif(p->>k,'') is null then delete from app_settings where key=k;
      else
        if (p->>k) !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'bad_input' using errcode='PT400'; end if;
        insert into app_settings(key,value) values (k,p->>k) on conflict (key) do update set value=excluded.value;
      end if;
    end if;
  end loop;
  perform _audit(a.id,'settings_update','settings',null,old,(select jsonb_object_agg(key,value) from app_settings));
  return jsonb_build_object('ok',true);
end $$;

-- rows behind every report
create or replace function _rr(p_from date, p_to date, p_emp int)
returns table(id bigint, employee_id int, work_date date, clock_in timestamptz, clock_out timestamptz, late_min int, early_min int,
  auto_closed boolean, b_start timestamptz, b_end timestamptz, on_break boolean, b_sec float8, allowed_sec float8, over_sec float8,
  over_cnt int, tot_sec float8, geo boolean) language sql stable as $$
  select w.id,w.employee_id,w.work_date,w.clock_in,w.clock_out,w.late_min,w.early_min,w.auto_closed,
    (select min(b.start_at) from breaks b where b.session_id=w.id),
    (select max(b.end_at) from breaks b where b.session_id=w.id),
    exists(select 1 from breaks b where b.session_id=w.id and b.end_at is null),
    coalesce((select sum(extract(epoch from coalesce(b.end_at,_now())-b.start_at)) from breaks b where b.session_id=w.id),0)::float8,
    coalesce((select sum(b.allowed_min*60) from breaks b where b.session_id=w.id),0)::float8,
    coalesce((select sum(greatest(0,extract(epoch from coalesce(b.end_at,_now())-b.start_at)-b.allowed_min*60)) from breaks b where b.session_id=w.id),0)::float8,
    (select count(*) from breaks b where b.session_id=w.id and extract(epoch from coalesce(b.end_at,_now())-b.start_at)-b.allowed_min*60>=60)::int,
    extract(epoch from coalesce(w.clock_out,_now())-w.clock_in)::float8,
    (select ev.in_geofence from attendance_events ev where ev.session_id=w.id and ev.event_type='CLOCK_IN' order by ev.id limit 1)
  from work_sessions w where w.work_date between p_from and p_to and (p_emp is null or w.employee_id=p_emp) $$;

create or replace function admin_report(p_token text, p_from date, p_to date, p_emp int default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; days jsonb; summ jsonb; today date := (_now() at time zone 'Asia/Riyadh')::date;
begin
  a := _admin(p_token);
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'bad_range' using errcode='PT400'; end if;
  perform _close_stale(null);
  select coalesce(jsonb_agg(jsonb_build_object('session_id',r.id,'date',r.work_date,'emp_id',e.id,'emp_no',e.emp_no,'name_ar',e.name_ar,'name_bn',e.name_bn,
      'clock_in',r.clock_in,'clock_out',r.clock_out,'break_start',r.b_start,'break_end',case when r.on_break then null else r.b_end end,'on_break',r.on_break,
      'work_min',floor((r.tot_sec-r.b_sec)/60),'break_min',floor(r.b_sec/60),'allowed_min',floor(r.allowed_sec/60),'over_min',floor(r.over_sec/60),
      'late_min',r.late_min,'early_min',r.early_min,'auto_closed',r.auto_closed,'geo',r.geo,'open',r.clock_out is null)
      order by r.work_date, e.id, r.clock_in),'[]'::jsonb)
  into days from _rr(p_from,p_to,p_emp) r join employees e on e.id=r.employee_id;

  select coalesce(jsonb_agg(row_to_json(s)::jsonb order by s.id),'[]'::jsonb) into summ from (
    select e.id, e.emp_no, e.name_ar, e.name_bn,
      count(distinct r.work_date) as days_present,
      coalesce(floor(sum(r.tot_sec-r.b_sec)/60),0)::int as work_min,
      coalesce(floor(sum(r.b_sec)/60),0)::int as break_min,
      coalesce(floor(sum(r.allowed_sec)/60),0)::int as allowed_min,
      coalesce(floor(sum(r.over_sec)/60),0)::int as over_min,
      coalesce(sum(r.over_cnt),0)::int as over_count,
      case when e.active then (select count(*) from generate_series(p_from::timestamp, least(p_to,today-1)::timestamp, interval '1 day') g(d)
          where g.d::date >= (e.created_at at time zone 'Asia/Riyadh')::date
            and (e.weekly_off is null or extract(dow from g.d)::int <> e.weekly_off)
            and not exists(select 1 from work_sessions w where w.employee_id=e.id and w.work_date=g.d::date)) else 0 end::int as absent_days,
      count(r.id) filter (where r.late_min>0)::int as late_count,
      coalesce(sum(r.late_min),0)::int as late_min,
      count(r.id) filter (where r.early_min>0)::int as early_count,
      coalesce(sum(r.early_min),0)::int as early_min
    from employees e left join _rr(p_from,p_to,p_emp) r on r.employee_id=e.id
    where (p_emp is null or e.id=p_emp) and (e.active or r.id is not null)
    group by e.id) s;
  return jsonb_build_object('from',p_from,'to',p_to,'summary',summ,'days',days);
end $$;

create or replace function admin_edit_session(p_token text, p_session bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users; w work_sessions; b breaks; old jsonb; nin timestamptz; nout timestamptz; nbs timestamptz; nbe timestamptz;
  sched timestamptz; se timestamptz; lt int := 0; er int := 0;
begin
  a := _admin(p_token);
  select * into w from work_sessions where id=p_session for update;
  if not found then raise exception 'not_found' using errcode='PT404'; end if;
  select * into b from breaks where session_id=w.id order by start_at limit 1;
  old := jsonb_build_object('clock_in',w.clock_in,'clock_out',w.clock_out,'break_start',b.start_at,'break_end',b.end_at);
  nin  := case when p ? 'clock_in' then (p->>'clock_in')::timestamptz else w.clock_in end;
  nout := case when p ? 'clock_out' then nullif(p->>'clock_out','')::timestamptz else w.clock_out end;
  nbs  := case when p ? 'break_start' then nullif(p->>'break_start','')::timestamptz else b.start_at end;
  nbe  := case when p ? 'break_end' then nullif(p->>'break_end','')::timestamptz else b.end_at end;
  if nin is null or (nout is not null and nout<=nin) then raise exception 'bad_times' using errcode='PT400'; end if;
  if nbs is null and nbe is not null then raise exception 'bad_times' using errcode='PT400'; end if;
  if nbs is not null and (nbs<nin or (nbe is not null and nbe<nbs) or (nout is not null and coalesce(nbe,nbs)>nout)) then
    raise exception 'bad_times' using errcode='PT400'; end if;
  if w.shift_start is not null then
    sched := (w.work_date + w.shift_start) at time zone 'Asia/Riyadh';
    lt := greatest(0,floor(extract(epoch from nin-sched)/60))::int;
    se := _sched_end(w.work_date,w.shift_start,w.shift_end);
    if nout is not null then er := greatest(0,floor(extract(epoch from se-nout)/60))::int; end if;
  end if;
  update work_sessions set clock_in=nin,clock_out=nout,late_min=lt,early_min=er,auto_closed=false where id=w.id;
  if nbs is null then delete from breaks where session_id=w.id;
  elsif b.id is not null then update breaks set start_at=nbs,end_at=nbe where id=b.id;
  else insert into breaks(session_id,employee_id,start_at,end_at,allowed_min,notified_pre1,notified_pre2,notified_end) values (w.id,w.employee_id,nbs,nbe,w.break_allowed,true,true,true);
  end if;
  perform _audit(a.id,'session_edit','work_session',w.id::text,old,jsonb_build_object('clock_in',nin,'clock_out',nout,'break_start',nbs,'break_end',nbe));
  return jsonb_build_object('ok',true);
end $$;

create or replace function admin_audit(p_token text, p_limit int default 50) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a admin_users;
begin a := _admin(p_token);
  return coalesce((select jsonb_agg(x) from (select l.id,l.action,l.target_type,l.target_id,l.old_value,l.new_value,l.at,u.username
     from audit_logs l left join admin_users u on u.id=l.admin_id order by l.id desc limit least(greatest(p_limit,1),200)) x),'[]'::jsonb); end $$;

-- ───────── Grants: only these functions are callable from the browser ─────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function login(text,text,text,text), me(text), set_lang(text,text), logout(text),
  clock_in(text,float8,float8,float8), break_start(text,float8,float8,float8), break_end(text,float8,float8,float8),
  clock_out(text,float8,float8,float8), save_push(text,text,text,text),
  admin_login(text,text), admin_live(text), admin_list_employees(text), admin_save_employee(text,jsonb),
  admin_set_pin(text,int,text), admin_unbind_device(text,int), admin_set_active(text,int,boolean),
  admin_list_shifts(text), admin_save_shift(text,jsonb), admin_get_settings(text), admin_save_settings(text,jsonb),
  admin_report(text,date,date,int), admin_edit_session(text,bigint,jsonb), admin_audit(text,int)
  to anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function due_break_notifications(), drop_push(text) to service_role;
  end if; end $$;
