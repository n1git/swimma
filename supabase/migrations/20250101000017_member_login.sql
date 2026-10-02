create table member_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_accounts_set_updated_at before update on member_accounts
  for each row execute function set_updated_at();

alter table member_accounts enable row level security;
revoke all on member_accounts from anon, authenticated;

alter table profiles add column member_account_id uuid references member_accounts(id);
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'coach', 'receptionist', 'finance', 'member'));
alter table profiles add constraint profiles_member_account_role
  check ((role = 'member') = (member_account_id is not null));
create unique index profiles_member_account_tenant_idx on profiles(member_account_id, tenant_id)
  where member_account_id is not null;

alter table members add column profile_id uuid unique references profiles(id);

drop index profiles_login_email_idx;
create unique index profiles_login_email_idx on profiles(email)
  where owner_id is null and member_account_id is null;

create or replace function enforce_profile_identity() returns trigger as $$
declare
  v_owner_org uuid;
  v_owner_email text;
  v_tenant_org uuid;
  v_account_email text;
begin
  perform pg_advisory_xact_lock(hashtext(new.email));
  if new.member_account_id is not null then
    select email into v_account_email from member_accounts where id = new.member_account_id;
    if v_account_email is distinct from new.email then
      raise exception 'member profile must use the account email';
    end if;
  elsif new.owner_id is null then
    if exists (select 1 from org_owners where email = new.email)
       or exists (select 1 from member_accounts where email = new.email) then
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

drop trigger profiles_enforce_identity on profiles;
create trigger profiles_enforce_identity before insert or update of email, owner_id, tenant_id, member_account_id on profiles
  for each row execute function enforce_profile_identity();

create or replace function enforce_owner_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'owner email cannot be changed';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.email));
  if exists (select 1 from profiles where email = new.email and owner_id is null and member_account_id is null)
     or exists (select 1 from member_accounts where email = new.email) then
    raise exception using errcode = '23505', message = 'Email sudah terdaftar';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create function enforce_member_account_email() returns trigger as $$
begin
  if tg_op = 'UPDATE' and new.email <> old.email then
    raise exception 'member account email cannot be changed';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.email));
  if exists (select 1 from org_owners where email = new.email)
     or exists (select 1 from profiles where email = new.email and member_account_id is null) then
    raise exception using errcode = '23505', message = 'Email sudah terdaftar';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_member_account_email() from public, anon, authenticated;

create trigger member_accounts_enforce_email before insert or update of email on member_accounts
  for each row execute function enforce_member_account_email();

create function check_member_profile_link() returns trigger as $$
begin
  if new.role = 'member'
     and not exists (select 1 from members where profile_id = new.id and tenant_id = new.tenant_id) then
    raise exception 'member profile must be linked to a member of the same tenant';
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function check_member_profile_link() from public, anon, authenticated;

create constraint trigger profiles_member_link after insert or update of role, tenant_id, member_account_id on profiles
  deferrable initially deferred
  for each row execute function check_member_profile_link();

create function enforce_member_profile_link() returns trigger as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from profiles where id = new.profile_id and role = 'member' and tenant_id = new.tenant_id
  ) then
    raise exception 'profile_id must reference a member profile of the same tenant';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_member_profile_link() from public, anon, authenticated;

create trigger members_enforce_profile_link before insert or update of profile_id, tenant_id on members
  for each row execute function enforce_member_profile_link();

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles p
    join tenants t on t.id = p.tenant_id and t.is_active
    left join org_owners o on o.id = p.owner_id
    left join member_accounts ma on ma.id = p.member_account_id
    where p.id = auth.uid()
      and p.is_active
      and p.tenant_id = current_tenant_id()
      and (p.owner_id is null or o.is_active)
      and (p.member_account_id is null or ma.is_active)
      and (
        p.sessions_valid_after is null
        or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= floor(extract(epoch from p.sessions_valid_after))
      )
  );
$$ language sql stable security definer set search_path = public;

create function current_member_id() returns uuid as $$
  select m.id from members m
  where m.profile_id = auth.uid() and m.tenant_id = current_tenant_id() and m.is_active
$$ language sql stable security definer set search_path = public;

revoke execute on function current_member_id() from public, anon;
grant execute on function current_member_id() to authenticated;

create function is_member() returns boolean as $$
  select current_app_role() = 'member' and is_active_user() and current_member_id() is not null;
$$ language sql stable;

create policy members_select_member on members for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and id = current_member_id());
create policy subscriptions_select_member on subscriptions for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id());
create policy invoices_select_member on invoices for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id());
create policy bookings_select_member on bookings for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id());

drop policy profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid() and is_active_user() and current_app_role() <> 'member')
  with check (id = auth.uid() and role = current_app_role() and tenant_id = current_tenant_id());

create view my_subscription_usage with (security_invoker = true) as
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
  select count(*) as sessions_used
  from bookings b
  join classes cl on cl.id = b.class_id
  where b.member_id = s.member_id
    and b.is_attended
    and cl.start_time::date >= s.start_date
    and (s.end_date is null or cl.start_time::date <= s.end_date)
) bc on true
where s.member_id = current_member_id();

revoke all on my_subscription_usage from anon, authenticated;
grant select on my_subscription_usage to authenticated;

update platform_modules set status = 'ready' where code = 'member_portal';

create function activate_member_account(p_member_id uuid, p_email text, p_password_hash text)
returns table (out_account_id uuid, out_profile_id uuid, out_created boolean) as $$
declare
  v_member members%rowtype;
  v_email text := lower(trim(p_email));
  v_account uuid;
  v_profile uuid;
  v_created boolean := false;
begin
  if not exists (select 1 from platform_modules where code = 'member_portal' and status = 'ready') then
    raise exception using errcode = 'MP003', message = 'Modul portal anggota belum tersedia';
  end if;

  select * into v_member from members where id = p_member_id for update;
  if v_member.id is null then
    raise exception 'member not found';
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

revoke execute on function activate_member_account(uuid, text, text) from public, anon, authenticated;
grant execute on function activate_member_account(uuid, text, text) to service_role;
