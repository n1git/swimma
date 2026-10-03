alter table organization_subscriptions drop constraint organization_subscriptions_status_check;
alter table organization_subscriptions add constraint organization_subscriptions_status_check
  check (status in ('pending_verification', 'pending', 'trial', 'active', 'suspended', 'cancelled'));

create or replace function enforce_billing_gate(p_org uuid) returns void as $$
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
  if v_status = 'pending_verification' then
    raise exception using errcode = 'SW003',
      message = 'Email pendaftaran belum diverifikasi. Buka tautan verifikasi yang dikirim ke email pemilik.';
  elsif v_status = 'pending' then
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

create table email_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_id uuid not null references org_owners(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_verifications_organization_idx on email_verifications(organization_id);
create index email_verifications_owner_idx on email_verifications(owner_id);

alter table email_verifications enable row level security;
revoke all on email_verifications from anon, authenticated;

create function register_organization_unverified(
  p_organization_name text,
  p_tenant_name text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_plan text,
  p_period text,
  p_club_type text,
  p_token_hash text
) returns table (organization_id uuid, tenant_id uuid, owner_id uuid, profile_id uuid) as $$
declare
  r record;
begin
  select * into r from register_organization(
    p_organization_name, p_tenant_name, p_owner_name, p_owner_email, p_password_hash, p_plan, p_period, p_club_type
  );
  update organization_subscriptions set status = 'pending_verification', trial_ends_at = null
  where organization_subscriptions.organization_id = r.organization_id;
  insert into email_verifications (organization_id, owner_id, token_hash, expires_at)
  values (r.organization_id, r.owner_id, p_token_hash, now() + interval '24 hours');
  return query select r.organization_id, r.tenant_id, r.owner_id, r.profile_id;
end;
$$ language plpgsql security definer set search_path = public;

create function verify_registration(p_token_hash text)
returns table (organization_id uuid, tenant_id uuid, profile_id uuid, email text, full_name text) as $$
declare
  v record;
  v_trial_days int;
begin
  select ev.* into v from email_verifications ev
  where ev.token_hash = p_token_hash and ev.used_at is null and ev.expires_at > now()
  for update;
  if v.id is null then
    return;
  end if;
  update email_verifications set used_at = now() where id = v.id;

  select sp.trial_days into v_trial_days
  from organization_subscriptions os join subscription_plans sp on sp.code = os.plan_code
  where os.organization_id = v.organization_id;

  update organization_subscriptions set
    status = case when coalesce(v_trial_days, 0) > 0 then 'trial' else 'pending' end,
    trial_ends_at = case when coalesce(v_trial_days, 0) > 0 then (now() at time zone 'Asia/Jakarta')::date + v_trial_days end
  where organization_subscriptions.organization_id = v.organization_id and status = 'pending_verification';

  return query
  select t.organization_id, p.tenant_id, p.id, p.email, p.full_name
  from profiles p join tenants t on t.id = p.tenant_id
  where p.owner_id = v.owner_id
  order by t.created_at
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

create function discard_unverified_registration(p_email text) returns boolean as $$
declare
  v_org uuid;
  v_tenants uuid[];
begin
  select o.organization_id into v_org
  from org_owners o join organization_subscriptions s on s.organization_id = o.organization_id
  where o.email = lower(trim(p_email)) and s.status = 'pending_verification';
  if v_org is null then
    return false;
  end if;
  select array_agg(id) into v_tenants from tenants where organization_id = v_org;
  if exists (select 1 from profiles where tenant_id = any(v_tenants) and owner_id is null)
     or exists (select 1 from members where tenant_id = any(v_tenants))
     or (select count(*) from tenants where organization_id = v_org) > 1 then
    raise exception 'registration already has data';
  end if;
  delete from email_verifications where organization_id = v_org;
  delete from profiles where tenant_id = any(v_tenants);
  delete from tenants where organization_id = v_org;
  delete from org_owners where organization_id = v_org;
  delete from organization_subscriptions where organization_id = v_org;
  delete from organizations where id = v_org;
  return true;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function verify_registration(text) from public, anon, authenticated;
revoke execute on function discard_unverified_registration(text) from public, anon, authenticated;
grant execute on function register_organization_unverified(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function verify_registration(text) to service_role;
grant execute on function discard_unverified_registration(text) to service_role;
