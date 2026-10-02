alter table profiles
  add column specialization text,
  add column session_rate numeric(12, 2) check (session_rate is null or session_rate >= 0);

create table coach_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  coach_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  number text,
  valid_until date,
  created_at timestamptz not null default now()
);

create index coach_certifications_tenant_id_idx on coach_certifications(tenant_id);
create index coach_certifications_coach_id_idx on coach_certifications(coach_id);

create function enforce_coach_certification_refs() returns trigger as $$
begin
  if not exists (
    select 1 from profiles where id = new.coach_id and role = 'coach' and tenant_id = new.tenant_id
  ) then
    raise exception 'coach_id must reference a profile with role coach in the same tenant';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_coach_certification_refs() from public, anon, authenticated;

create trigger coach_certifications_enforce_refs before insert or update of coach_id, tenant_id on coach_certifications
  for each row execute function enforce_coach_certification_refs();

alter table coach_certifications enable row level security;

create policy coach_certifications_select on coach_certifications for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or (is_coach() and coach_id = auth.uid())));
create policy coach_certifications_write_admin on coach_certifications for all to authenticated
  using (is_admin() and tenant_id = current_tenant_id())
  with check (is_admin() and tenant_id = current_tenant_id());

revoke all on coach_certifications from anon, authenticated;
grant select, insert, update, delete on coach_certifications to authenticated;

create function enforce_profile_self_update() returns trigger as $$
begin
  if current_app_role() = '' or is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - array['full_name', 'phone', 'updated_at'])
     is distinct from (to_jsonb(old) - array['full_name', 'phone', 'updated_at']) then
    raise exception 'only an admin may change these profile fields';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger profiles_enforce_self_update before update on profiles
  for each row execute function enforce_profile_self_update();
