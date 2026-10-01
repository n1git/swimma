create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_tenants int not null default 3 check (max_tenants > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();

create table org_owners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  email text not null unique check (email = lower(email)),
  full_name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index org_owners_organization_id_idx on org_owners(organization_id);

create trigger org_owners_set_updated_at before update on org_owners
  for each row execute function set_updated_at();

alter table organizations enable row level security;
alter table org_owners enable row level security;
revoke all on organizations, org_owners from anon, authenticated;

alter table tenants add column organization_id uuid references organizations(id);
alter table profiles add column owner_id uuid references org_owners(id);

do $$
declare
  r record;
  v_org uuid;
  v_owner uuid;
  v_dups text;
begin
  update profiles set email = lower(email) where email <> lower(email);

  create temp table owner_candidates as
  select distinct on (t.id)
    t.id as tenant_id, p.id as profile_id, p.email, p.full_name, p.created_at,
    c.password_hash, c.failed_login_count, c.locked_until, c.last_login_at
  from tenants t
  join profiles p on p.tenant_id = t.id and p.role = 'admin' and p.is_active
  join auth_credentials c on c.profile_id = p.id
  order by t.id, p.created_at, p.id;

  for r in
    select
      email,
      (array_agg(profile_id order by created_at, profile_id))[1] as first_profile,
      (array_agg(tenant_id order by created_at, profile_id))[1] as first_tenant,
      array_agg(tenant_id) as tenant_ids
    from owner_candidates
    group by email
  loop
    insert into organizations (name, max_tenants)
    select name, greatest(3, cardinality(r.tenant_ids)) from tenants where id = r.first_tenant
    returning id into v_org;

    insert into org_owners (organization_id, email, full_name, password_hash, failed_login_count, locked_until, last_login_at)
    select v_org, c.email, c.full_name, c.password_hash, c.failed_login_count, c.locked_until, c.last_login_at
    from owner_candidates c where c.profile_id = r.first_profile
    returning id into v_owner;

    update tenants set organization_id = v_org where id = any(r.tenant_ids);
    update profiles set owner_id = v_owner
    where role = 'admin' and email = r.email and tenant_id = any(r.tenant_ids);
  end loop;

  drop table owner_candidates;

  for r in select id, name from tenants where organization_id is null loop
    insert into organizations (name) values (r.name) returning id into v_org;
    update tenants set organization_id = v_org where id = r.id;
  end loop;

  delete from auth_credentials where profile_id in (select id from profiles where owner_id is not null);

  select string_agg(distinct email, ', ') into v_dups from (
    select email from profiles where owner_id is null group by email having count(*) > 1
    union
    select p.email from profiles p join org_owners o on o.email = p.email where p.owner_id is null
  ) x;
  if v_dups is not null then
    raise exception 'Email ganda antar akun: %. Selesaikan sebelum migrasi.', v_dups;
  end if;
end;
$$;

alter table tenants alter column organization_id set not null;
create index tenants_organization_id_idx on tenants(organization_id);

alter table profiles add constraint profiles_email_lowercase check (email = lower(email));
alter table profiles add constraint profiles_owner_is_admin check (owner_id is null or role = 'admin');
create unique index profiles_login_email_idx on profiles(email) where owner_id is null;
create unique index profiles_owner_tenant_idx on profiles(owner_id, tenant_id) where owner_id is not null;

create function enforce_profile_identity() returns trigger as $$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_tenant_org uuid;
begin
  perform pg_advisory_xact_lock(hashtext(new.email));
  if new.owner_id is null then
    if exists (select 1 from org_owners where email = new.email) then
      raise exception using errcode = '23505', message = 'Email sudah terdaftar';
    end if;
  else
    select organization_id, email into v_owner_org, v_owner_email from org_owners where id = new.owner_id;
    select organization_id into v_tenant_org from tenants where id = new.tenant_id;
    if v_owner_org is distinct from v_tenant_org or v_owner_email is distinct from new.email then
      raise exception 'owner profile must belong to a tenant of the owner organization and use the owner email';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_profile_identity() from public, anon, authenticated;

create trigger profiles_enforce_identity before insert or update of email, owner_id, tenant_id on profiles
  for each row execute function enforce_profile_identity();

create function enforce_owner_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'owner email cannot be changed';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.email));
  if exists (select 1 from profiles where email = new.email and owner_id is null) then
    raise exception using errcode = '23505', message = 'Email sudah terdaftar';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_owner_email() from public, anon, authenticated;

create trigger org_owners_enforce_email before insert or update of email on org_owners
  for each row execute function enforce_owner_email();

create function enforce_org_max_tenants() returns trigger as $$
declare
  v_max int;
  v_count int;
begin
  select max_tenants into v_max from organizations where id = new.organization_id for update;
  select count(*) into v_count from tenants where organization_id = new.organization_id;
  if v_count >= v_max then
    raise exception using
      errcode = 'SW004',
      message = format('Batas %s klub untuk organisasi ini sudah tercapai. Hubungi admin platform Swimma untuk menambah batas.', v_max);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_org_max_tenants() from public, anon, authenticated;

create trigger tenants_enforce_org_max before insert on tenants
  for each row execute function enforce_org_max_tenants();

create policy organizations_select_own on organizations for select to authenticated
  using (
    is_admin()
    and exists (select 1 from tenants t where t.id = current_tenant_id() and t.organization_id = organizations.id)
  );
grant select on organizations to authenticated;

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    left join org_owners o on o.id = p.owner_id
    where p.id = auth.uid()
      and p.is_active
      and p.tenant_id = current_tenant_id()
      and (p.owner_id is null or o.is_active)
      and (
        p.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from p.sessions_valid_after))
      )
  );
$$ language sql stable security definer set search_path = public;

create function register_organization(
  p_organization_name text,
  p_tenant_name text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_trial_days int
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  v_org uuid;
  v_tenant uuid;
  v_owner uuid;
  v_profile uuid;
  v_plan uuid;
  v_email text := lower(trim(p_owner_email));
begin
  select id into v_plan from platform_plans where name = 'Trial' and is_active;
  if v_plan is null then
    raise exception 'trial plan not available';
  end if;

  insert into organizations (name) values (p_organization_name) returning id into v_org;
  insert into org_owners (organization_id, email, full_name, password_hash)
  values (v_org, v_email, p_owner_name, p_password_hash) returning id into v_owner;

  v_tenant := create_tenant_row(v_org, p_tenant_name, v_plan, p_trial_days);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', p_owner_name, v_email, v_owner) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function create_tenant_row(p_org uuid, p_name text, p_plan uuid, p_trial_days int) returns uuid as $$
declare
  v_tenant uuid;
  v_slug text;
begin
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'klub'), 30) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into tenants (organization_id, name, slug) values (p_org, p_name, v_slug) returning id into v_tenant;

  insert into platform_subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (v_tenant, p_plan, 'trial', (now() at time zone 'Asia/Jakarta')::date + p_trial_days);

  return v_tenant;
end;
$$ language plpgsql security definer set search_path = public;

create function create_tenant_for_owner(
  p_owner_id uuid,
  p_tenant_name text,
  p_trial_days int
) returns table (tenant_id uuid, profile_id uuid) as $$
declare
  v_owner org_owners%rowtype;
  v_plan uuid;
  v_tenant uuid;
  v_profile uuid;
begin
  select * into v_owner from org_owners where id = p_owner_id and is_active;
  if v_owner.id is null then
    raise exception 'owner not found';
  end if;

  select id into v_plan from platform_plans where name = 'Trial' and is_active;
  if v_plan is null then
    raise exception 'trial plan not available';
  end if;

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, v_plan, p_trial_days);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_tenant_row(uuid, text, uuid, int) from public, anon, authenticated;
revoke execute on function register_organization(text, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function create_tenant_for_owner(uuid, text, int) from public, anon, authenticated;
grant execute on function register_organization(text, text, text, text, text, int) to service_role;
grant execute on function create_tenant_for_owner(uuid, text, int) to service_role;

create or replace view platform_tenant_usage as
select
  t.id as tenant_id,
  (select count(*) from children c where c.tenant_id = t.id and c.is_active) as active_members,
  (select count(*) from locations l where l.tenant_id = t.id) as locations,
  t.organization_id
from tenants t;

create view platform_organization_usage as
select
  o.id as organization_id,
  o.name,
  o.max_tenants,
  (select count(*) from tenants t where t.organization_id = o.id) as tenants,
  coalesce(sum(u.active_members), 0)::bigint as active_members,
  coalesce(sum(u.locations), 0)::bigint as locations
from organizations o
left join platform_tenant_usage u on u.organization_id = o.id
group by o.id;

revoke all on platform_tenant_usage, platform_organization_usage from anon, authenticated;
