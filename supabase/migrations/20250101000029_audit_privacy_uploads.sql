do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute $q$update storage.buckets
      set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
      where id = 'promo'$q$;
  end if;
end;
$$;

create function protect_attended_class() returns trigger as $$
begin
  if coalesce(current_setting('swimma.purge', true), '') = 'on' then
    return old;
  end if;
  if exists (select 1 from bookings where class_id = old.id and is_attended) then
    raise exception using errcode = 'CL001', message = 'Kelas yang sudah punya catatan kehadiran tidak bisa dihapus';
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function protect_attended_class() from public, anon, authenticated;

create trigger classes_protect_attended before delete on classes
  for each row execute function protect_attended_class();

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  actor_label text,
  tenant_id uuid references tenants(id),
  organization_id uuid references organizations(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb
);

create index audit_log_tenant_at_idx on audit_log(tenant_id, at desc);
create index audit_log_organization_at_idx on audit_log(organization_id, at desc);

alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated;
grant select on audit_log to authenticated;

create policy audit_log_select on audit_log for select to authenticated
  using (
    (tenant_id = (select current_tenant_id()) and (select is_admin()))
    or (
      (select current_profile_is_owner())
      and organization_id = (select organization_id from tenants where id = (select current_tenant_id()))
    )
  );

create function protect_audit_log() returns trigger as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('swimma.purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'audit log is append-only';
end;
$$ language plpgsql set search_path = public;

create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function protect_audit_log();

create function log_audit(
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_details jsonb default '{}'::jsonb,
  p_tenant_id uuid default null,
  p_organization_id uuid default null,
  p_actor_id uuid default null,
  p_actor_role text default null,
  p_actor_label text default null
) returns void as $$
declare
  v_tenant uuid := coalesce(p_tenant_id, current_tenant_id());
begin
  if coalesce(current_setting('swimma.audit_suppress', true), '') = 'on' then
    return;
  end if;
  insert into audit_log (actor_id, actor_role, actor_label, tenant_id, organization_id, action, target_type, target_id, details)
  values (
    coalesce(p_actor_id, auth.uid()),
    coalesce(p_actor_role, nullif(auth.jwt() ->> 'app_role', '')),
    p_actor_label,
    v_tenant,
    coalesce(p_organization_id, (select organization_id from tenants where id = v_tenant)),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function log_audit(text, text, uuid, jsonb, uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function log_audit(text, text, uuid, jsonb, uuid, uuid, uuid, text, text) to service_role;

create function audit_staff_profile_change() returns trigger as $$
begin
  if new.role = 'member' then
    return new;
  end if;
  if new.role is distinct from old.role or new.is_head_coach is distinct from old.is_head_coach then
    perform log_audit('staff.role', 'profile', new.id,
      jsonb_build_object('from', old.role, 'to', new.role, 'head_coach', new.is_head_coach), new.tenant_id);
  end if;
  if new.is_active is distinct from old.is_active then
    perform log_audit(case when new.is_active then 'staff.activate' else 'staff.deactivate' end, 'profile', new.id, '{}'::jsonb, new.tenant_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create function audit_member_status_change() returns trigger as $$
begin
  perform log_audit(case when new.is_active then 'member.activate' else 'member.deactivate' end, 'member', new.id, '{}'::jsonb, new.tenant_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create function audit_invoice_status_change() returns trigger as $$
begin
  perform log_audit(case new.status when 'paid' then 'invoice.paid' else 'invoice.void' end, 'invoice', new.id,
    jsonb_build_object('amount', new.amount), new.tenant_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create function audit_order_void() returns trigger as $$
begin
  perform log_audit('order.void', 'order', new.id,
    jsonb_build_object('number', new.number, 'total', new.total, 'reason', new.void_reason), new.tenant_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function audit_staff_profile_change() from public, anon, authenticated;
revoke execute on function audit_member_status_change() from public, anon, authenticated;
revoke execute on function audit_invoice_status_change() from public, anon, authenticated;
revoke execute on function audit_order_void() from public, anon, authenticated;

create trigger profiles_audit after update of role, is_active, is_head_coach on profiles
  for each row execute function audit_staff_profile_change();
create trigger members_audit_status after update of is_active on members
  for each row when (old.is_active is distinct from new.is_active)
  execute function audit_member_status_change();
create trigger invoices_audit_status after update of status on invoices
  for each row when (old.status = 'outstanding' and new.status in ('paid', 'void'))
  execute function audit_invoice_status_change();
create trigger orders_audit_void after update of status on orders
  for each row when (old.status <> 'void' and new.status = 'void')
  execute function audit_order_void();

create table consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  organization_id uuid references organizations(id),
  subject_type text not null check (subject_type in ('owner', 'member')),
  subject_id uuid not null,
  kind text not null check (kind in ('terms_privacy', 'member_data', 'guardian')),
  version text not null,
  guardian_name text check (guardian_name is null or length(guardian_name) <= 200),
  recorded_by uuid,
  accepted_at timestamptz not null default now()
);

create index consents_subject_idx on consents(subject_id);
create index consents_tenant_idx on consents(tenant_id);
create index consents_organization_idx on consents(organization_id);

alter table consents enable row level security;
revoke all on consents from anon, authenticated;
grant select, insert on consents to authenticated;

create function stamp_consent() returns trigger as $$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
    new.accepted_at := now();
  end if;
  if new.tenant_id is not null then
    new.organization_id := (select organization_id from tenants where id = new.tenant_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function stamp_consent() from public, anon, authenticated;

create trigger consents_stamp before insert on consents
  for each row execute function stamp_consent();

create policy consents_select on consents for select to authenticated
  using (
    (tenant_id = (select current_tenant_id()) and (select is_admin()))
    or (subject_type = 'member' and subject_id = (select current_member_id()))
  );

create policy consents_insert on consents for insert to authenticated
  with check (
    tenant_id = (select current_tenant_id())
    and subject_type = 'member'
    and kind in ('member_data', 'guardian')
    and ((select is_admin()) or (select is_receptionist()) or (select is_coach()))
    and exists (select 1 from members m where m.id = subject_id and m.tenant_id = (select current_tenant_id()))
  );

create function anonymise_member(p_member_id uuid, p_reason text, p_confirm text) returns void as $$
declare
  m members%rowtype;
  v_account uuid;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if coalesce(p_confirm, '') <> 'ANONIMKAN' then
    raise exception using errcode = 'AN001', message = 'Ketik ANONIMKAN untuk mengonfirmasi';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'AN002', message = 'Tulis alasan, minimal 5 karakter';
  end if;
  select * into m from members where id = p_member_id and tenant_id = current_tenant_id() for update;
  if m.id is null then
    raise exception using errcode = 'AN003', message = 'Anggota tidak ditemukan';
  end if;

  perform set_config('swimma.audit_suppress', 'on', true);

  update members set
    full_name = 'Anggota anonim ' || left(id::text, 8),
    date_of_birth = date '1900-01-01',
    notes = null,
    address = null,
    contact_name = null,
    contact_phone = null,
    is_active = false,
    profile_id = null
  where id = m.id;

  if m.profile_id is not null then
    select member_account_id into v_account from profiles where id = m.profile_id;
    update resource_bookings set created_by = null where created_by = m.profile_id;
    delete from profiles where id = m.profile_id;
    if v_account is not null and not exists (select 1 from profiles where member_account_id = v_account) then
      delete from member_accounts where id = v_account;
    end if;
  end if;

  update bookings set notes = null where member_id = m.id;
  update orders set customer_name = null where member_id = m.id;
  update resource_bookings set guest_name = null, guest_phone = null where member_id = m.id;
  update consents set guardian_name = null where subject_type = 'member' and subject_id = m.id;

  perform set_config('swimma.audit_suppress', '', true);
  perform log_audit('member.anonymise', 'member', m.id, jsonb_build_object('reason', v_reason), m.tenant_id);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function anonymise_member(uuid, text, text) from public, anon;
grant execute on function anonymise_member(uuid, text, text) to authenticated, service_role;
