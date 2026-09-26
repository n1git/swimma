create table superadmins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger superadmins_set_updated_at before update on superadmins
  for each row execute function set_updated_at();

alter table superadmins enable row level security;
revoke all on superadmins from anon, authenticated;

create table platform_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(12, 2) not null default 0 check (price >= 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  member_limit int check (member_limit is null or member_limit > 0),
  location_limit int check (location_limit is null or location_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table platform_plans enable row level security;
create policy platform_plans_select_active on platform_plans for select to anon, authenticated
  using (is_active);
revoke all on platform_plans from anon, authenticated;
grant select on platform_plans to anon, authenticated;

insert into platform_plans (name, price, billing_cycle, member_limit, location_limit) values
  ('Trial', 0, 'monthly', 20, 1),
  ('Starter', 300000, 'monthly', 75, 1),
  ('Growth', 750000, 'monthly', 250, 3),
  ('Pro', 1500000, 'monthly', null, null);

create table platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id),
  plan_id uuid not null references platform_plans(id),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  trial_ends_at date,
  activated_at timestamptz,
  activated_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_subscriptions_set_updated_at before update on platform_subscriptions
  for each row execute function set_updated_at();

alter table platform_subscriptions enable row level security;
create policy platform_subscriptions_select_own on platform_subscriptions for select to authenticated
  using (is_admin() and tenant_id = current_tenant_id());
revoke all on platform_subscriptions from anon, authenticated;
grant select on platform_subscriptions to authenticated;

create function enforce_plan_member_limit() returns trigger as $$
declare
  v_limit int;
  v_count int;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;

  select pp.member_limit into v_limit
  from platform_subscriptions ps
  join platform_plans pp on pp.id = ps.plan_id
  where ps.tenant_id = new.tenant_id
  for update of ps;

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

create trigger children_enforce_plan_member_limit before insert or update of is_active on children
  for each row execute function enforce_plan_member_limit();

create function enforce_plan_location_limit() returns trigger as $$
declare
  v_limit int;
  v_count int;
begin
  select pp.location_limit into v_limit
  from platform_subscriptions ps
  join platform_plans pp on pp.id = ps.plan_id
  where ps.tenant_id = new.tenant_id
  for update of ps;

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

create trigger locations_enforce_plan_location_limit before insert on locations
  for each row execute function enforce_plan_location_limit();

create view platform_tenant_usage as
select
  t.id as tenant_id,
  (select count(*) from children c where c.tenant_id = t.id and c.is_active) as active_members,
  (select count(*) from locations l where l.tenant_id = t.id) as locations
from tenants t;

revoke all on platform_tenant_usage from anon, authenticated;

revoke update on tenants from authenticated;
grant update (name, logo_url, primary_color) on tenants to authenticated;

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    where p.id = auth.uid() and p.is_active and p.tenant_id = current_tenant_id()
  );
$$ language sql stable security definer set search_path = public;
