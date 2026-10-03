create function current_profile_is_owner() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and owner_id is not null);
$$ language sql stable security definer set search_path = public;

revoke execute on function current_profile_is_owner() from public, anon;
grant execute on function current_profile_is_owner() to authenticated, service_role;

drop policy tenants_select_own on tenants;
create policy tenants_select_own on tenants for select to authenticated
  using (id = current_tenant_id() and (select is_active_user()));

drop policy locations_select_all on locations;
create policy locations_select_all on locations for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy class_types_select_all on class_types;
create policy class_types_select_all on class_types for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy classes_select_all on classes;
create policy classes_select_all on classes for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy membership_packages_select_all on membership_packages;
create policy membership_packages_select_all on membership_packages for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy promo_select_active on promo;
create policy promo_select_active on promo for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and active_from <= now()
    and (active_until is null or active_until >= now())
    and (select is_active_user())
  );

drop policy resources_select on resources;
create policy resources_select on resources for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy resource_hours_select on resource_hours;
create policy resource_hours_select on resource_hours for select to authenticated
  using (tenant_id = current_tenant_id() and (select is_active_user()));

drop policy profiles_update_admin on profiles;
create policy profiles_update_admin on profiles for update to authenticated
  using (is_admin() and tenant_id = current_tenant_id() and (owner_id is null or (select current_profile_is_owner())))
  with check (tenant_id = current_tenant_id() and (owner_id is null or (select current_profile_is_owner())));

alter table superadmins
  add column totp_secret text,
  add column totp_pending_secret text,
  add column totp_enabled_at timestamptz;

create table superadmin_sessions (
  id uuid primary key default gen_random_uuid(),
  superadmin_id uuid not null references superadmins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index superadmin_sessions_superadmin_idx on superadmin_sessions(superadmin_id);

create table superadmin_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  superadmin_id uuid not null references superadmins(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index superadmin_recovery_codes_superadmin_idx on superadmin_recovery_codes(superadmin_id);

alter table superadmin_sessions enable row level security;
alter table superadmin_recovery_codes enable row level security;
revoke all on superadmin_sessions, superadmin_recovery_codes from anon, authenticated;

create function rate_limit_exceeded(p_key text, p_limit int, p_window_seconds int) returns boolean as $$
  select coalesce((
    select hits >= p_limit
    from auth_rate_limits
    where key = p_key and window_start >= now() - make_interval(secs => p_window_seconds)
  ), false);
$$ language sql stable security definer set search_path = public;

revoke execute on function rate_limit_exceeded(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_exceeded(text, int, int) to service_role;
