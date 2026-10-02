insert into platform_modules (code, name, description, status, sort) values
  ('resource_booking', 'Fasilitas & Booking', 'Fasilitas, jam buka, dan booking lapangan, lintasan, studio, atau area', 'soon', 10);

insert into club_type_modules (club_type, module_code) values
  ('swimming', 'resource_booking'),
  ('gym', 'resource_booking');

create table tenant_module_overrides (
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_code text not null references platform_modules(code),
  enabled boolean not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  primary key (tenant_id, module_code),
  check (module_code <> 'members')
);

alter table tenant_module_overrides enable row level security;
revoke all on tenant_module_overrides from anon, authenticated;
grant select on tenant_module_overrides to authenticated;
create policy tenant_module_overrides_select_admin on tenant_module_overrides for select to authenticated
  using (is_admin() and tenant_id = current_tenant_id());

create or replace function club_has_module(p_tenant uuid, p_module text) returns boolean as $$
  select exists (
    select 1
    from platform_modules pm
    join tenants t on t.id = p_tenant
    where pm.code = p_module
      and pm.status = 'ready'
      and (
        p_module = 'members'
        or coalesce(
          (select o.enabled from tenant_module_overrides o where o.tenant_id = p_tenant and o.module_code = p_module),
          exists (select 1 from club_type_modules m where m.club_type = t.club_type and m.module_code = p_module)
        )
      )
  );
$$ language sql stable security definer set search_path = public;

create function current_club_modules()
returns table (code text, name text, description text, status text, in_type boolean, override boolean, effective boolean, sort int) as $$
  select
    pm.code,
    pm.name,
    pm.description,
    pm.status,
    exists (
      select 1 from tenants t join club_type_modules m on m.club_type = t.club_type
      where t.id = current_tenant_id() and m.module_code = pm.code
    ),
    (select o.enabled from tenant_module_overrides o where o.tenant_id = current_tenant_id() and o.module_code = pm.code),
    club_has_module(current_tenant_id(), pm.code),
    pm.sort
  from platform_modules pm
  order by pm.sort;
$$ language sql stable security definer set search_path = public;

revoke execute on function current_club_modules() from public, anon;
grant execute on function current_club_modules() to authenticated;

create function set_club_module(p_module text, p_enabled boolean) returns void as $$
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_module = 'members' or not exists (select 1 from platform_modules where code = p_module) then
    raise exception using errcode = 'MD001', message = 'Modul ini tidak dapat diubah';
  end if;
  insert into tenant_module_overrides (tenant_id, module_code, enabled, changed_by)
  values (current_tenant_id(), p_module, p_enabled, auth.uid())
  on conflict (tenant_id, module_code) do update
    set enabled = excluded.enabled, changed_by = excluded.changed_by, changed_at = now();
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function set_club_module(text, boolean) from public, anon;
grant execute on function set_club_module(text, boolean) to authenticated;

alter table tenants add column onboarding_completed_at timestamptz;
update tenants set onboarding_completed_at = now();

create function complete_onboarding() returns void as $$
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update tenants set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_tenant_id();
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function complete_onboarding() from public, anon;
grant execute on function complete_onboarding() to authenticated;

alter table club_types add column terms jsonb not null default '{}'::jsonb;

update club_types set terms = jsonb_build_object(
  'member', 'Anggota', 'coach', 'Pelatih', 'visit', 'Kunjungan',
  'resource', 'Lintasan', 'session', 'Kelas', 'location', 'Lokasi Kolam'
) where code = 'swimming';

update club_types set terms = jsonb_build_object(
  'member', 'Member', 'coach', 'Personal Trainer', 'visit', 'Kunjungan',
  'resource', 'Area', 'session', 'Sesi', 'location', 'Lokasi Gym'
) where code = 'gym';

create table club_type_presets (
  id uuid primary key default gen_random_uuid(),
  club_type text not null references club_types(code),
  kind text not null check (kind in ('court', 'lane', 'studio', 'room', 'floor', 'other')),
  name_pattern text not null,
  default_count int not null default 1 check (default_count > 0),
  slot_minutes int not null default 60 check (slot_minutes > 0),
  sort int not null default 0
);

alter table club_type_presets enable row level security;
create policy club_type_presets_select_all on club_type_presets for select to authenticated using (true);
revoke all on club_type_presets from anon, authenticated;
grant select on club_type_presets to authenticated;

insert into club_type_presets (club_type, kind, name_pattern, default_count, slot_minutes, sort) values
  ('swimming', 'lane', 'Lintasan {n}', 4, 60, 1),
  ('gym', 'floor', 'Area Gym {n}', 1, 60, 1);
