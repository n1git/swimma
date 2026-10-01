revoke execute on function generate_invoices_for_period(date, date, date, uuid) from public, anon, authenticated;
grant execute on function generate_invoices_for_period(date, date, date, uuid) to service_role;

create table auth_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

alter table auth_rate_limits enable row level security;
revoke all on auth_rate_limits from anon, authenticated;

create function hit_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean as $$
declare
  v_hits int;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  if random() < 0.01 then
    delete from auth_rate_limits where window_start < now() - interval '1 day';
  end if;

  insert into auth_rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - v_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - v_window then now() else r.window_start end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int, int) to service_role;

alter table profiles add column sessions_valid_after timestamptz;

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    where p.id = auth.uid()
      and p.is_active
      and p.tenant_id = current_tenant_id()
      and (
        p.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from p.sessions_valid_after))
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function enforce_plan_member_limit() returns trigger as $$
declare
  v_limit int;
  v_status text;
  v_trial_ends_at date;
  v_count int;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;

  select pp.member_limit, ps.status, ps.trial_ends_at into v_limit, v_status, v_trial_ends_at
  from platform_subscriptions ps
  join platform_plans pp on pp.id = ps.plan_id
  where ps.tenant_id = new.tenant_id
  for update of ps;

  if v_status = 'trial' and v_trial_ends_at < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using
      errcode = 'SW003',
      message = 'Masa trial klub ini sudah berakhir. Hubungi admin platform Swimma untuk memilih paket.';
  end if;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from children where tenant_id = new.tenant_id and is_active;

  if v_count >= v_limit then
    raise exception using
      errcode = 'SW001',
      message = format('Batas %s anggota aktif untuk paket klub ini sudah tercapai. Hubungi admin platform Swimma untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function enforce_plan_location_limit() returns trigger as $$
declare
  v_limit int;
  v_status text;
  v_trial_ends_at date;
  v_count int;
begin
  select pp.location_limit, ps.status, ps.trial_ends_at into v_limit, v_status, v_trial_ends_at
  from platform_subscriptions ps
  join platform_plans pp on pp.id = ps.plan_id
  where ps.tenant_id = new.tenant_id
  for update of ps;

  if v_status = 'trial' and v_trial_ends_at < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using
      errcode = 'SW003',
      message = 'Masa trial klub ini sudah berakhir. Hubungi admin platform Swimma untuk memilih paket.';
  end if;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from locations where tenant_id = new.tenant_id;

  if v_count >= v_limit then
    raise exception using
      errcode = 'SW002',
      message = format('Batas %s lokasi untuk paket klub ini sudah tercapai. Hubungi admin platform Swimma untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
