create table club_types (
  code text primary key,
  name text not null,
  status text not null check (status in ('ready', 'soon')),
  sort int not null default 0
);

alter table club_types enable row level security;
create policy club_types_select_all on club_types for select to anon, authenticated using (true);
revoke all on club_types from anon, authenticated;
grant select on club_types to anon, authenticated;

insert into club_types (code, name, status, sort) values
  ('swimming', 'Klub Renang', 'ready', 1),
  ('gym', 'Gym', 'soon', 2);

create table club_type_modules (
  club_type text not null references club_types(code),
  module_code text not null references platform_modules(code),
  primary key (club_type, module_code)
);

alter table club_type_modules enable row level security;
create policy club_type_modules_select_all on club_type_modules for select to anon, authenticated using (true);
revoke all on club_type_modules from anon, authenticated;
grant select on club_type_modules to anon, authenticated;

insert into club_type_modules (club_type, module_code)
select t.code, m.code
from club_types t
cross join platform_modules m
where m.code in ('members', 'plans', 'billing', 'cash_ledger', 'classes', 'payroll', 'promo', 'member_portal')
   or (t.code = 'gym' and m.code = 'checkin');

alter table tenants add column club_type text not null default 'swimming' references club_types(code);

create function club_has_module(p_tenant uuid, p_module text) returns boolean as $$
  select exists (
    select 1
    from tenants t
    join club_type_modules m on m.club_type = t.club_type
    join platform_modules pm on pm.code = m.module_code
    where t.id = p_tenant and m.module_code = p_module and pm.status = 'ready'
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function club_has_module(uuid, text) from public, anon, authenticated;
grant execute on function club_has_module(uuid, text) to service_role;

create function current_club_has_module(p_module text) returns boolean as $$
  select club_has_module(current_tenant_id(), p_module);
$$ language sql stable security definer set search_path = public;

revoke execute on function current_club_has_module(text) from public, anon;
grant execute on function current_club_has_module(text) to authenticated;

create or replace function activate_member_account(p_member_id uuid, p_email text, p_password_hash text)
returns table (out_account_id uuid, out_profile_id uuid, out_created boolean) as $$
declare
  v_member members%rowtype;
  v_email text := lower(trim(p_email));
  v_account uuid;
  v_profile uuid;
  v_created boolean := false;
begin
  select * into v_member from members where id = p_member_id for update;
  if v_member.id is null then
    raise exception 'member not found';
  end if;
  if not club_has_module(v_member.tenant_id, 'member_portal') then
    raise exception using errcode = 'MP003', message = 'Modul portal anggota belum tersedia';
  end if;
  if not v_member.is_active then
    raise exception using errcode = 'MP004', message = 'Anggota nonaktif tidak dapat diaktifkan';
  end if;
  if v_member.profile_id is not null then
    raise exception using errcode = 'MP002', message = 'Akun anggota ini sudah diaktifkan';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_email));

  select id into v_account from member_accounts where email = v_email;
  if v_account is null then
    insert into member_accounts (email, full_name, password_hash, must_change_password)
    values (v_email, v_member.full_name, p_password_hash, true)
    returning id into v_account;
    v_created := true;
  end if;

  if exists (select 1 from profiles where member_account_id = v_account and tenant_id = v_member.tenant_id) then
    raise exception using errcode = 'MP001', message = 'Email ini sudah dipakai anggota lain di klub ini';
  end if;

  insert into profiles (tenant_id, role, full_name, email, member_account_id)
  values (v_member.tenant_id, 'member', v_member.full_name, v_email, v_account)
  returning id into v_profile;

  update members set profile_id = v_profile where id = p_member_id;

  return query select v_account, v_profile, v_created;
end;
$$ language plpgsql security definer set search_path = public;

drop function register_organization(text, text, text, text, text, text, text);
drop function create_tenant_for_owner(uuid, text);
drop function create_tenant_row(uuid, text);

create function create_tenant_row(p_org uuid, p_name text, p_club_type text) returns uuid as $$
declare
  v_tenant uuid;
  v_slug text;
begin
  if not exists (select 1 from club_types where code = p_club_type and status = 'ready') then
    raise exception 'club type not available';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'klub'), 30) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into tenants (organization_id, name, slug, club_type) values (p_org, p_name, v_slug, p_club_type) returning id into v_tenant;
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
  p_period text,
  p_club_type text default 'swimming'
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

  v_tenant := create_tenant_row(v_org, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', p_owner_name, v_email, v_owner) returning id into v_profile;

  return query select v_org, v_tenant, v_owner, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

create function create_tenant_for_owner(p_owner_id uuid, p_tenant_name text, p_club_type text default 'swimming')
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

  v_tenant := create_tenant_row(v_owner.organization_id, p_tenant_name, p_club_type);

  insert into profiles (tenant_id, role, full_name, email, owner_id)
  values (v_tenant, 'admin', v_owner.full_name, v_owner.email, v_owner.id) returning id into v_profile;

  return query select v_tenant, v_profile;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function create_tenant_row(uuid, text, text) from public, anon, authenticated;
revoke execute on function register_organization(text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function create_tenant_for_owner(uuid, text, text) from public, anon, authenticated;
grant execute on function register_organization(text, text, text, text, text, text, text, text) to service_role;
grant execute on function create_tenant_for_owner(uuid, text, text) to service_role;
