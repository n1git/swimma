create table checkin_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  location_id uuid references locations(id),
  name text not null,
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index checkin_points_tenant_id_idx on checkin_points(tenant_id);

create function enforce_checkin_point_refs() returns trigger as $$
begin
  if new.location_id is not null and not exists (
    select 1 from locations where id = new.location_id and tenant_id = new.tenant_id
  ) then
    raise exception 'location_id must belong to the same tenant';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger checkin_points_enforce_refs before insert or update of location_id, tenant_id on checkin_points
  for each row execute function enforce_checkin_point_refs();

alter table checkin_points enable row level security;
revoke all on checkin_points from anon, authenticated;
grant select (id, tenant_id, location_id, name, is_active, created_at) on checkin_points to authenticated;
grant insert (location_id, name) on checkin_points to authenticated;
grant update (location_id, name, is_active) on checkin_points to authenticated;

create policy checkin_points_select_admin on checkin_points for select to authenticated
  using (is_admin() and tenant_id = current_tenant_id());
create policy checkin_points_insert_admin on checkin_points for insert to authenticated
  with check (is_admin() and tenant_id = current_tenant_id());
create policy checkin_points_update_admin on checkin_points for update to authenticated
  using (is_admin() and tenant_id = current_tenant_id())
  with check (is_admin() and tenant_id = current_tenant_id());

create table checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  point_id uuid references checkin_points(id),
  checked_in_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'manual')),
  subscription_id uuid references subscriptions(id),
  created_by uuid references profiles(id)
);

create index checkins_tenant_time_idx on checkins(tenant_id, checked_in_at desc);
create index checkins_member_time_idx on checkins(member_id, checked_in_at desc);
create index checkins_subscription_idx on checkins(subscription_id);

alter table checkins enable row level security;
revoke all on checkins from anon, authenticated;
grant select on checkins to authenticated;

create policy checkins_select_staff on checkins for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_head_coach()));
create policy checkins_select_coach on checkins for select to authenticated
  using (tenant_id = current_tenant_id() and is_coach() and coach_owns_member(member_id));
create policy checkins_select_member on checkins for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id());

create function checkin_window(p_back int default 0) returns bigint as $$
  select floor(extract(epoch from now()) / 30)::bigint - p_back;
$$ language sql stable;

create function checkin_token_for(p_point uuid, p_window bigint) returns text as $$
  select substr(encode(hmac(p_point::text || ':' || p_window::text, cp.secret, 'sha256'), 'hex'), 1, 12)
  from checkin_points cp where cp.id = p_point;
$$ language sql stable security definer set search_path = public, extensions;

revoke execute on function checkin_window(int) from public, anon, authenticated;
revoke execute on function checkin_token_for(uuid, bigint) from public, anon, authenticated;

create function checkin_token(p_point_id uuid) returns text as $$
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (
    select 1 from checkin_points where id = p_point_id and tenant_id = current_tenant_id() and is_active
  ) then
    raise exception 'point not found';
  end if;
  return checkin_token_for(p_point_id, checkin_window(0));
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function checkin_token(uuid) from public, anon;
grant execute on function checkin_token(uuid) to authenticated;

create function checkin_core(p_member_id uuid, p_point_id uuid, p_method text, p_actor uuid)
returns table (out_checkin_id uuid, out_checked_in_at timestamptz, out_already boolean) as $$
declare
  v_member members%rowtype;
  v_sub subscriptions%rowtype;
  v_pkg membership_packages%rowtype;
  v_existing checkins%rowtype;
  v_used int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_id uuid;
  v_at timestamptz;
begin
  select * into v_member from members where id = p_member_id;
  if v_member.id is null then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;
  if not club_has_module(v_member.tenant_id, 'checkin') then
    raise exception using errcode = 'CK001', message = 'Check-in belum tersedia di klub ini';
  end if;
  if not v_member.is_active then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;

  perform pg_advisory_xact_lock(hashtext('checkin:' || p_member_id::text));

  select * into v_existing from checkins
  where member_id = p_member_id and checked_in_at > now() - interval '120 minutes'
  order by checked_in_at desc limit 1;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.checked_in_at, true;
    return;
  end if;

  select * into v_sub from subscriptions
  where member_id = p_member_id and status = 'active'
    and start_date <= v_today and (end_date is null or end_date >= v_today)
  limit 1;
  if v_sub.id is null then
    raise exception using errcode = 'CK003', message = 'Anda belum punya paket aktif';
  end if;

  select * into v_pkg from membership_packages where id = v_sub.package_id;
  if v_pkg.pricing_mode = 'session_pack' then
    select count(*) into v_used from checkins where subscription_id = v_sub.id;
    if v_used >= v_pkg.sessions_included then
      raise exception using errcode = 'CK004', message = 'Sesi paket Anda sudah habis';
    end if;
  end if;

  insert into checkins (tenant_id, member_id, point_id, method, subscription_id, created_by)
  values (v_member.tenant_id, p_member_id, p_point_id, p_method, v_sub.id, p_actor)
  returning id, checked_in_at into v_id, v_at;

  return query select v_id, v_at, false;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function checkin_core(uuid, uuid, text, uuid) from public, anon, authenticated;

create function record_checkin(p_point_id uuid, p_token text)
returns table (out_checkin_id uuid, out_checked_in_at timestamptz, out_already boolean) as $$
declare
  v_point checkin_points%rowtype;
  v_member uuid;
begin
  if current_app_role() <> 'member' or not is_active_user() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  select * into v_point from checkin_points
  where id = p_point_id and tenant_id = current_tenant_id() and is_active;
  if v_point.id is null
     or p_token is null
     or not (
       p_token = checkin_token_for(v_point.id, checkin_window(0))
       or p_token = checkin_token_for(v_point.id, checkin_window(1))
     ) then
    raise exception using errcode = 'CK005', message = 'Kode QR tidak valid atau sudah kedaluwarsa, pindai ulang';
  end if;

  v_member := current_member_id();
  if v_member is null then
    raise exception using errcode = 'CK002', message = 'Keanggotaan Anda tidak aktif';
  end if;

  return query select * from checkin_core(v_member, v_point.id, 'qr', null);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function record_checkin(uuid, text) from public, anon;
grant execute on function record_checkin(uuid, text) to authenticated;

create function manual_checkin(p_member_id uuid, p_point_id uuid default null)
returns table (out_checkin_id uuid, out_checked_in_at timestamptz, out_already boolean) as $$
begin
  if not (is_admin() or (is_coach() and coach_owns_member(p_member_id))) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (select 1 from members where id = p_member_id and tenant_id = current_tenant_id()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_point_id is not null and not exists (
    select 1 from checkin_points where id = p_point_id and tenant_id = current_tenant_id()
  ) then
    raise exception 'point not found';
  end if;
  return query select * from checkin_core(p_member_id, p_point_id, 'manual', auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function manual_checkin(uuid, uuid) from public, anon;
grant execute on function manual_checkin(uuid, uuid) to authenticated;

create or replace view subscription_usage with (security_invoker = true) as
select
  s.id as subscription_id,
  s.tenant_id,
  s.member_id,
  m.full_name as member_name,
  mp.sessions_included,
  coalesce(bc.sessions_used, 0) as sessions_used,
  greatest(mp.sessions_included - coalesce(bc.sessions_used, 0), 0) as sessions_remaining,
  s.end_date,
  (s.end_date is not null and s.end_date < current_date) as is_expired
from subscriptions s
join membership_packages mp on mp.id = s.package_id and mp.pricing_mode = 'session_pack'
join member_names m on m.id = s.member_id
left join lateral (
  select case
    when current_club_has_module('checkin') then (
      select count(*) from checkins c where c.subscription_id = s.id
    )
    else (
      select count(*)
      from bookings b
      join classes cl on cl.id = b.class_id
      where b.member_id = s.member_id
        and b.is_attended
        and cl.start_time::date >= s.start_date
        and (s.end_date is null or cl.start_time::date <= s.end_date)
    )
  end as sessions_used
) bc on true;

create or replace view my_subscription_usage with (security_invoker = true) as
select
  s.id as subscription_id,
  s.member_id,
  s.status,
  mp.name as package_name,
  mp.sessions_included,
  coalesce(bc.sessions_used, 0) as sessions_used,
  greatest(mp.sessions_included - coalesce(bc.sessions_used, 0), 0) as sessions_remaining,
  s.start_date,
  s.end_date,
  (s.end_date is not null and s.end_date < current_date) as is_expired
from subscriptions s
join membership_packages mp on mp.id = s.package_id and mp.pricing_mode = 'session_pack'
left join lateral (
  select case
    when current_club_has_module('checkin') then (
      select count(*) from checkins c where c.subscription_id = s.id
    )
    else (
      select count(*)
      from bookings b
      join classes cl on cl.id = b.class_id
      where b.member_id = s.member_id
        and b.is_attended
        and cl.start_time::date >= s.start_date
        and (s.end_date is null or cl.start_time::date <= s.end_date)
    )
  end as sessions_used
) bc on true
where s.member_id = current_member_id();

create view checkin_daily_counts with (security_invoker = true) as
select
  count(*) filter (
    where (checked_in_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
  ) as visits_today,
  count(*) filter (
    where (checked_in_at at time zone 'Asia/Jakarta')::date >= date_trunc('week', now() at time zone 'Asia/Jakarta')::date
  ) as visits_week
from checkins;

create view checkin_hourly_30d with (security_invoker = true) as
select h.hour, coalesce(c.visits, 0) as visits
from generate_series(0, 23) as h(hour)
left join (
  select extract(hour from checked_in_at at time zone 'Asia/Jakarta')::int as hour, count(*) as visits
  from checkins
  where checked_in_at >= now() - interval '30 days'
  group by 1
) c on c.hour = h.hour
order by h.hour;

create view dormant_members with (security_invoker = true) as
select m.id as member_id, m.full_name, max(c.checked_in_at) as last_checkin_at
from members m
join subscriptions s on s.member_id = m.id
  and s.status = 'active'
  and (s.end_date is null or s.end_date >= (now() at time zone 'Asia/Jakarta')::date)
left join checkins c on c.member_id = m.id
where m.is_active
group by m.id, m.full_name
having max(c.checked_in_at) is null or max(c.checked_in_at) < now() - interval '14 days';

revoke all on checkin_daily_counts, checkin_hourly_30d, dormant_members from anon, authenticated;
grant select on checkin_daily_counts, checkin_hourly_30d, dormant_members to authenticated;

update platform_modules set status = 'ready' where code = 'checkin';
update club_types set status = 'ready' where code = 'gym';
