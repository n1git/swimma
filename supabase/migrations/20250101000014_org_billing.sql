create table subscription_plans (
  code text primary key check (code in ('standard', 'advanced')),
  name text not null,
  price_per_user_month numeric(12, 2) not null check (price_per_user_month >= 0),
  club_limit int check (club_limit is null or club_limit > 0),
  trial_days int not null default 0 check (trial_days >= 0),
  yearly_free_months numeric(3, 1) not null default 0 check (yearly_free_months >= 0 and yearly_free_months < 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table subscription_plans enable row level security;
create policy subscription_plans_select_active on subscription_plans for select to anon, authenticated
  using (is_active);
revoke all on subscription_plans from anon, authenticated;
grant select on subscription_plans to anon, authenticated;

insert into subscription_plans (code, name, price_per_user_month, club_limit, trial_days, yearly_free_months) values
  ('standard', 'Standard', 150000, 3, 30, 0.5),
  ('advanced', 'Advanced', 250000, null, 0, 0.5);

create table platform_modules (
  code text primary key,
  name text not null,
  description text,
  status text not null check (status in ('ready', 'soon')),
  sort int not null default 0
);

alter table platform_modules enable row level security;
create policy platform_modules_select_all on platform_modules for select to anon, authenticated using (true);
revoke all on platform_modules from anon, authenticated;
grant select on platform_modules to anon, authenticated;

insert into platform_modules (code, name, description, status, sort) values
  ('members', 'Anggota', 'Data anggota, pelatih utama, dan kontak', 'ready', 1),
  ('plans', 'Paket Keanggotaan', 'Paket bulanan dan paket sesi', 'ready', 2),
  ('billing', 'Tagihan', 'Langganan anggota dan tagihan otomatis', 'ready', 3),
  ('cash_ledger', 'Buku Kas', 'Pemasukan dan pengeluaran klub', 'ready', 4),
  ('classes', 'Jadwal & Presensi', 'Kelas, booking, dan kehadiran', 'ready', 5),
  ('payroll', 'Gaji Pelatih', 'Penggajian terhubung ke buku kas', 'ready', 6),
  ('promo', 'Promo', 'Pengumuman dan promo klub', 'ready', 7),
  ('member_portal', 'Portal Anggota', 'Akses mandiri untuk anggota', 'soon', 8),
  ('checkin', 'Check-in', 'Check-in anggota di lokasi', 'soon', 9);

create table organization_subscriptions (
  organization_id uuid primary key references organizations(id),
  plan_code text not null references subscription_plans(code),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  status text not null check (status in ('pending', 'trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at date,
  current_period_start date,
  current_period_end date,
  club_limit_override int check (club_limit_override is null or club_limit_override > 0),
  activated_at timestamptz,
  activated_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_subscriptions_set_updated_at before update on organization_subscriptions
  for each row execute function set_updated_at();

alter table organization_subscriptions enable row level security;
create policy organization_subscriptions_select_own on organization_subscriptions for select to authenticated
  using (
    is_admin()
    and organization_id = (select t.organization_id from tenants t where t.id = current_tenant_id())
  );
revoke all on organization_subscriptions from anon, authenticated;
grant select on organization_subscriptions to authenticated;

with per_org as (
  select
    o.id as organization_id,
    o.max_tenants,
    count(ps.id) as sub_count,
    coalesce(bool_or(pp.member_limit is null and pp.location_limit is null), false) as unlimited,
    max(case ps.status when 'active' then 4 when 'trial' then 3 when 'suspended' then 2 when 'cancelled' then 1 end) as status_rank,
    max(ps.trial_ends_at) as trial_ends_at,
    max(ps.activated_at) as activated_at,
    (array_agg(ps.activated_by order by ps.activated_at desc nulls last) filter (where ps.activated_by is not null))[1] as activated_by
  from organizations o
  left join tenants t on t.organization_id = o.id
  left join platform_subscriptions ps on ps.tenant_id = t.id
  left join platform_plans pp on pp.id = ps.plan_id
  group by o.id
),
resolved as (
  select
    p.*,
    case when p.sub_count = 0 or p.unlimited then 'advanced' else 'standard' end as plan_code,
    case
      when p.sub_count = 0 then 'active'
      else case p.status_rank when 4 then 'active' when 3 then 'trial' when 2 then 'suspended' else 'cancelled' end
    end as status
  from per_org p
)
insert into organization_subscriptions (
  organization_id, plan_code, billing_period, status, trial_ends_at, club_limit_override,
  activated_at, activated_by, notes
)
select
  r.organization_id,
  r.plan_code,
  'monthly',
  r.status,
  case when r.status = 'trial'
    then coalesce(r.trial_ends_at, (now() at time zone 'Asia/Jakarta')::date + (select trial_days from subscription_plans where code = r.plan_code))
  end,
  case
    when r.plan_code = 'advanced' then null
    when r.max_tenants is distinct from (select club_limit from subscription_plans where code = r.plan_code) then r.max_tenants
  end,
  case when r.status = 'active' then coalesce(r.activated_at, now()) end,
  case when r.status = 'active' then coalesce(r.activated_by, 'migrasi') end,
  case when r.sub_count = 0 then 'Dimigrasi tanpa langganan lama' end
from resolved r;

create function platform_quote(p_plan text, p_period text, p_users int)
returns table (users int, unit_price numeric, months numeric, total numeric, per_month numeric) as $$
declare
  v_price numeric;
  v_free numeric;
  v_users int := greatest(coalesce(p_users, 1), 1);
  v_months numeric;
  v_span numeric;
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select price_per_user_month, yearly_free_months into v_price, v_free
  from subscription_plans where code = p_plan;
  if v_price is null then
    raise exception 'plan not found';
  end if;
  v_months := case when p_period = 'yearly' then 12 - v_free else 1 end;
  v_span := case when p_period = 'yearly' then 12 else 1 end;
  return query select
    v_users,
    v_price,
    v_months,
    round(v_users * v_price * v_months, 2),
    round(v_users * v_price * v_months / v_span, 2);
end;
$$ language plpgsql stable set search_path = public;

create function organization_internal_users(p_org uuid) returns int as $$
  select (
    (select count(*) from org_owners where organization_id = p_org and is_active)
    + (
      select count(*) from profiles p
      join tenants t on t.id = p.tenant_id
      where t.organization_id = p_org
        and p.owner_id is null
        and p.role in ('admin', 'coach')
        and p.is_active
    )
  )::int;
$$ language sql stable security definer set search_path = public;

revoke execute on function platform_quote(text, text, int) from public, anon, authenticated;
revoke execute on function organization_internal_users(uuid) from public, anon, authenticated;
grant execute on function platform_quote(text, text, int) to service_role;
grant execute on function organization_internal_users(uuid) to service_role;

drop trigger members_enforce_plan_member_limit on members;
drop trigger locations_enforce_plan_location_limit on locations;
drop function enforce_plan_member_limit();
drop function enforce_plan_location_limit();

create function enforce_billing_gate(p_org uuid) returns void as $$
declare
  v_status text;
  v_trial date;
begin
  select status, trial_ends_at into v_status, v_trial
  from organization_subscriptions where organization_id = p_org;
  if v_status is null then
    return;
  end if;
  if not exists (select 1 from tenants where organization_id = p_org) then
    return;
  end if;
  if v_status = 'pending' then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi belum diaktifkan. Hubungi admin platform Swimma untuk mengaktifkannya.';
  elsif v_status in ('suspended', 'cancelled') then
    raise exception using errcode = 'SW003',
      message = 'Langganan organisasi sedang ditangguhkan atau dibatalkan. Hubungi admin platform Swimma.';
  elsif v_status = 'trial' and v_trial < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'SW003',
      message = 'Masa trial organisasi ini sudah berakhir. Hubungi admin platform Swimma untuk memilih paket.';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_billing_gate(uuid) from public, anon, authenticated;

create function enforce_member_billing() returns trigger as $$
declare
  v_org uuid;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  select organization_id into v_org from tenants where id = new.tenant_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_member_billing() from public, anon, authenticated;

create trigger members_enforce_billing before insert or update of is_active on members
  for each row execute function enforce_member_billing();

create function enforce_profile_billing() returns trigger as $$
declare
  v_org uuid;
begin
  if new.owner_id is not null or new.role not in ('admin', 'coach') or not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.owner_id is null and old.role in ('admin', 'coach') then
    return new;
  end if;
  select organization_id into v_org from tenants where id = new.tenant_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_profile_billing() from public, anon, authenticated;

create trigger profiles_enforce_billing before insert or update of is_active on profiles
  for each row execute function enforce_profile_billing();

create function enforce_owner_billing() returns trigger as $$
begin
  perform enforce_billing_gate(new.organization_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_owner_billing() from public, anon, authenticated;

create trigger org_owners_enforce_billing before insert on org_owners
  for each row execute function enforce_owner_billing();

create or replace function enforce_org_max_tenants() returns trigger as $$
declare
  v_limit int;
  v_count int;
  v_exists boolean;
begin
  select true, coalesce(s.club_limit_override, sp.club_limit) into v_exists, v_limit
  from organization_subscriptions s
  join subscription_plans sp on sp.code = s.plan_code
  where s.organization_id = new.organization_id
  for update of s;

  if v_exists is null then
    return new;
  end if;

  perform enforce_billing_gate(new.organization_id);

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from tenants where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception using
      errcode = 'SW004',
      message = format('Batas %s klub untuk paket organisasi ini sudah tercapai. Hubungi admin platform Swimma untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create function enforce_subscription_limits() returns trigger as $$
declare
  v_limit int;
  v_count int;
begin
  if new.plan_code is not distinct from old.plan_code
     and new.club_limit_override is not distinct from old.club_limit_override then
    return new;
  end if;
  select coalesce(new.club_limit_override, club_limit) into v_limit
  from subscription_plans where code = new.plan_code;
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from tenants where organization_id = new.organization_id;
  if v_count > v_limit then
    raise exception using
      errcode = 'SW004',
      message = format('Organisasi memiliki %s klub, melebihi batas %s klub paket ini.', v_count, v_limit);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_subscription_limits() from public, anon, authenticated;

create trigger organization_subscriptions_enforce_limits before update of plan_code, club_limit_override on organization_subscriptions
  for each row execute function enforce_subscription_limits();

drop function register_organization(text, text, text, text, text, int);
drop function create_tenant_for_owner(uuid, text, int);
drop function create_tenant_row(uuid, text, uuid, int);

create function create_tenant_row(p_org uuid, p_name text) returns uuid as $$
declare
  v_tenant uuid;
  v_slug text;
begin
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'klub'), 30) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into tenants (organization_id, name, slug) values (p_org, p_name, v_slug) returning id into v_tenant;
  return v_tenant;
end;
$$ language plpgsql security definer set search_path = public;

create function register_organization(
  p_organization_name text,
  p_tenant_name text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_plan text,
  p_period text
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  v_org uuid;
  v_tenant uuid;
  v_owner uuid;
  v_profile uuid;
  v_trial_days int;
  v_email text := lower(trim(p_owner_email));
begin
  if p_period is null or p_period not in ('monthly', 'yearly') then
    raise exception 'invalid billing period';
  end if;
  select trial_days into v_trial_days from subscription_plans where code = p_plan and is_active;
  if not found then
    raise exception 'plan not available';
  end if;

  insert into organizations (name) values (p_organization_name) returning id into v_org;

  insert into organization_subscriptions (organization_id, plan_code, billing_period, status, trial_ends_at)
  values (
    v_org,
    p_plan,
    p_period,
    case when v_trial_days > 0 then 'trial' else 'pending' end,
    case when v_trial_days > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  );

  insert into org_owners (organization_id, email, full_name, password_hash)
  values (v_org, v_email, p_owner_name, p_password_hash) returning id into v_owner;

  v_tenant := create_tenant_row(v_org, p_tenant_name);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', p_owner_name, v_email, v_owner) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text)
returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner org_owners%rowtype;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from org_owners where id = p_owner_id and is_active;
  if v_owner.id is null then
    raise exception 'owner not found';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function set_organization_status(
  p_organization_id uuid,
  p_status text,
  p_actor text default null,
  p_period_start date default null,
  p_period_end date default null
) returns void as $$
declare
  v_period text;
  v_previous text;
  v_end date;
begin
  if p_status not in ('pending', 'trial', 'active', 'suspended', 'cancelled') then
    raise exception 'invalid status';
  end if;

  select billing_period, status into v_period, v_previous
  from organization_subscriptions where organization_id = p_organization_id for update;
  if v_period is null then
    raise exception 'subscription not found';
  end if;

  v_end := coalesce(
    p_period_end,
    case when p_period_start is not null then p_period_start + case when v_period = 'yearly' then interval '1 year' else interval '1 month' end end
  );

  update organization_subscriptions set
    status = p_status,
    current_period_start = case when p_status = 'active' and p_period_start is not null then p_period_start else current_period_start end,
    current_period_end = case when p_status = 'active' and v_end is not null then v_end else current_period_end end,
    activated_at = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then now() else activated_at end,
    activated_by = case when p_status = 'active' and (v_previous <> 'active' or p_period_start is not null) then p_actor else activated_by end
  where organization_id = p_organization_id;

  update tenants set is_active = (p_status in ('pending', 'trial', 'active'))
  where organization_id = p_organization_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_tenant_row(uuid, text) from public, anon, authenticated;
revoke execute on function register_organization(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function create_tenant_for_owner(uuid, text) from public, anon, authenticated;
revoke execute on function set_organization_status(uuid, text, text, date, date) from public, anon, authenticated;
grant execute on function register_organization(text, text, text, text, text, text, text) to service_role;
grant execute on function create_tenant_for_owner(uuid, text) to service_role;
grant execute on function set_organization_status(uuid, text, text, date, date) to service_role;

drop view platform_organization_usage;

create view platform_organization_usage as
select
  o.id as organization_id,
  o.name,
  s.plan_code,
  s.billing_period,
  s.status,
  s.trial_ends_at,
  s.current_period_start,
  s.current_period_end,
  s.club_limit_override,
  coalesce(s.club_limit_override, sp.club_limit) as club_limit,
  (select count(*) from tenants t where t.organization_id = o.id) as clubs,
  coalesce((select sum(u.active_members) from platform_tenant_usage u where u.organization_id = o.id), 0)::bigint as members,
  organization_internal_users(o.id) as internal_users,
  q.unit_price,
  q.months,
  q.total,
  q.per_month
from organizations o
left join organization_subscriptions s on s.organization_id = o.id
left join subscription_plans sp on sp.code = s.plan_code
left join lateral (
  select * from platform_quote(s.plan_code, s.billing_period, organization_internal_users(o.id))
  where s.plan_code is not null
) q on true;

revoke all on platform_organization_usage from anon, authenticated;
