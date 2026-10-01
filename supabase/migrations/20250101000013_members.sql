drop policy children_select on children;
drop policy children_insert on children;
drop policy children_update on children;
drop policy children_delete on children;
drop policy bookings_select on bookings;
drop policy bookings_insert_parent on bookings;
drop policy bookings_update on bookings;
drop policy bookings_delete on bookings;
drop policy subscriptions_select on subscriptions;
drop policy invoices_select on invoices;

drop view report_member_counts;
drop view subscription_usage;

alter table children rename to members;
alter table bookings rename column child_id to member_id;
alter table subscriptions rename column child_id to member_id;
alter table invoices rename column child_id to member_id;

alter index children_tenant_id_idx rename to members_tenant_id_idx;
alter index children_full_name_trgm_idx rename to members_full_name_trgm_idx;
alter index bookings_child_id_idx rename to bookings_member_id_idx;
alter index subscriptions_one_active_per_child_idx rename to subscriptions_one_active_per_member_idx;
alter index subscriptions_child_id_idx rename to subscriptions_member_id_idx;
alter index invoices_child_id_idx rename to invoices_member_id_idx;

alter table members rename constraint children_pkey to members_pkey;
alter table members rename constraint children_tenant_id_fkey to members_tenant_id_fkey;
alter table members rename constraint children_preferred_location_id_fkey to members_preferred_location_id_fkey;
alter table bookings rename constraint bookings_child_id_fkey to bookings_member_id_fkey;
alter table bookings rename constraint bookings_child_id_class_id_key to bookings_member_id_class_id_key;
alter table subscriptions rename constraint subscriptions_child_id_fkey to subscriptions_member_id_fkey;
alter table invoices rename constraint invoices_child_id_fkey to invoices_member_id_fkey;

alter trigger children_set_updated_at on members rename to members_set_updated_at;
alter trigger children_enforce_plan_member_limit on members rename to members_enforce_plan_member_limit;

alter table members
  add column coach_id uuid references profiles(id),
  add column contact_name text,
  add column contact_phone text;

update members m
set contact_name = p.full_name, contact_phone = p.phone
from profiles p
where p.id = m.parent_id;

drop trigger children_enforce_parent_role on members;
drop function enforce_children_parent_role();
alter table members drop column parent_id;

delete from profiles where role = 'parent';
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'coach'));

create index members_coach_id_idx on members(coach_id);

create function enforce_members_refs() returns trigger as $$
begin
  if new.preferred_location_id is not null and not exists (
    select 1 from locations where id = new.preferred_location_id and tenant_id = new.tenant_id
  ) then
    raise exception 'preferred_location_id must belong to the same tenant';
  end if;
  if new.coach_id is not null and not exists (
    select 1 from profiles where id = new.coach_id and role = 'coach' and tenant_id = new.tenant_id
  ) then
    raise exception 'coach_id must reference a profile with role coach in the same tenant';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger members_enforce_refs before insert or update of preferred_location_id, coach_id, tenant_id on members
  for each row execute function enforce_members_refs();

create function enforce_coach_member_update() returns trigger as $$
begin
  if is_coach() and (to_jsonb(new) - 'notes' - 'updated_at') is distinct from (to_jsonb(old) - 'notes' - 'updated_at') then
    raise exception 'coach may only change member notes';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger members_enforce_coach_update before update on members
  for each row execute function enforce_coach_member_update();

create or replace function enforce_booking_capacity() returns trigger as $$
declare
  v_capacity int;
  v_count int;
  v_member_tenant_id uuid;
  v_class_tenant_id uuid;
begin
  select capacity, tenant_id into v_capacity, v_class_tenant_id from classes where id = new.class_id for update;
  if v_capacity is null then
    raise exception 'class not found';
  end if;
  select tenant_id into v_member_tenant_id from members where id = new.member_id;
  if v_member_tenant_id is null or v_member_tenant_id <> v_class_tenant_id or new.tenant_id <> v_class_tenant_id then
    raise exception 'member and class must belong to the same tenant as the booking';
  end if;
  select count(*) into v_count from bookings where class_id = new.class_id;
  if v_count >= v_capacity then
    raise exception 'class is full';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_booking_capacity() from public, anon, authenticated;

create or replace function enforce_subscriptions_tenant() returns trigger as $$
begin
  if not exists (select 1 from members where id = new.member_id and tenant_id = new.tenant_id) then
    raise exception 'member_id must belong to the same tenant as the subscription';
  end if;
  if not exists (select 1 from membership_packages where id = new.package_id and tenant_id = new.tenant_id) then
    raise exception 'package_id must belong to the same tenant as the subscription';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function enforce_invoices_tenant() returns trigger as $$
begin
  if not exists (select 1 from members where id = new.member_id and tenant_id = new.tenant_id) then
    raise exception 'member_id must belong to the same tenant as the invoice';
  end if;
  if not exists (select 1 from subscriptions where id = new.subscription_id and tenant_id = new.tenant_id) then
    raise exception 'subscription_id must belong to the same tenant as the invoice';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function enforce_plan_member_limit() returns trigger as $$
declare
  v_limit int;
  v_status text;
  v_trial_ends_at date;
  v_count int;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;

  select pp.member_limit, ps.status, ps.trial_ends_at into v_limit, v_status, v_trial_ends_at
  from platform_subscriptions ps
  join platform_plans pp on pp.id = ps.plan_id
  where ps.tenant_id = new.tenant_id
  for update of ps;

  if v_status = 'trial' and v_trial_ends_at < (now() at time zone 'Asia/Jakarta')::date then
    raise exception using
      errcode = 'SW003',
      message = 'Masa trial klub ini sudah berakhir. Hubungi admin platform Swimma untuk memilih paket.';
  end if;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from members where tenant_id = new.tenant_id and is_active;

  if v_count >= v_limit then
    raise exception using
      errcode = 'SW001',
      message = format('Batas %s anggota aktif untuk paket klub ini sudah tercapai. Hubungi admin platform Swimma untuk upgrade paket.', v_limit);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function generate_invoices_for_period(
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_tenant_id uuid default null
) returns setof invoices as $$
  insert into invoices (tenant_id, member_id, subscription_id, amount, due_date, period_start, period_end)
  select s.tenant_id, s.member_id, s.id, mp.price, p_due_date, p_period_start, p_period_end
  from subscriptions s
  join membership_packages mp on mp.id = s.package_id
  where s.status = 'active'
    and mp.pricing_mode = 'cycle'
    and (p_tenant_id is null or s.tenant_id = p_tenant_id)
  on conflict (subscription_id, period_start) do nothing
  returning *;
$$ language sql security definer set search_path = public;

create or replace function create_invoice_for_session_pack_subscription() returns trigger as $$
declare
  v_price numeric(12, 2);
  v_pricing_mode text;
begin
  select price, pricing_mode into v_price, v_pricing_mode
  from membership_packages
  where id = new.package_id;

  if v_pricing_mode <> 'session_pack' then
    return new;
  end if;

  insert into invoices (tenant_id, member_id, subscription_id, amount, due_date, period_start, period_end)
  values (new.tenant_id, new.member_id, new.id, v_price, new.start_date, new.start_date, new.end_date)
  on conflict (subscription_id, period_start) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop function search_similar_children(text, date);

create function search_similar_members(
  p_full_name text,
  p_date_of_birth date default null
) returns table (
  id uuid,
  full_name text,
  date_of_birth date,
  contact_name text,
  similarity real
) language sql stable as $$
  select
    m.id,
    m.full_name,
    m.date_of_birth,
    m.contact_name,
    greatest(
      similarity(m.full_name, p_full_name),
      case when p_date_of_birth is not null and m.date_of_birth = p_date_of_birth then 1 else 0 end
    ) as similarity
  from members m
  where m.is_active
    and m.tenant_id = current_tenant_id()
    and (
      similarity(m.full_name, p_full_name) > 0.3
      or (p_date_of_birth is not null and m.date_of_birth = p_date_of_birth)
    )
  order by similarity desc
  limit 5;
$$;

grant execute on function search_similar_members(text, date) to authenticated;

create view report_member_counts with (security_invoker = true) as
select
  count(*) filter (where is_active) as active_members,
  count(*) filter (where not is_active) as inactive_members
from members;

create view subscription_usage with (security_invoker = true) as
select
  s.id as subscription_id,
  s.tenant_id,
  s.member_id,
  m.full_name as member_name,
  mp.sessions_included,
  coalesce(bc.sessions_used, 0) as sessions_used,
  greatest(mp.sessions_included - coalesce(bc.sessions_used, 0), 0) as sessions_remaining,
  s.end_date,
  (s.end_date is not null and s.end_date < current_date) as is_expired
from subscriptions s
join membership_packages mp on mp.id = s.package_id and mp.pricing_mode = 'session_pack'
join members m on m.id = s.member_id
left join lateral (
  select count(*) as sessions_used
  from bookings b
  join classes cl on cl.id = b.class_id
  where b.member_id = s.member_id
    and b.is_attended
    and cl.start_time::date >= s.start_date
    and (s.end_date is null or cl.start_time::date <= s.end_date)
) bc on true;

grant select on report_member_counts, subscription_usage to authenticated;

drop function is_parent();
drop function owns_child(uuid);

create function coach_owns_member(p_member_id uuid) returns boolean as $$
  select exists (
    select 1 from members m
    join profiles p on p.id = m.coach_id
    where m.id = p_member_id
      and m.coach_id = auth.uid()
      and m.tenant_id = current_tenant_id()
      and p.is_active
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function coach_owns_member(uuid) from public, anon;
grant execute on function coach_owns_member(uuid) to authenticated;

create policy members_select on members for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or (is_coach() and coach_id = auth.uid())));
create policy members_insert on members for insert to authenticated
  with check (tenant_id = current_tenant_id() and is_admin());
create policy members_update on members for update to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or (is_coach() and coach_id = auth.uid())))
  with check (tenant_id = current_tenant_id() and (is_admin() or (is_coach() and coach_id = auth.uid())));
create policy members_delete on members for delete to authenticated
  using (tenant_id = current_tenant_id() and is_admin());

create policy bookings_select on bookings for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and (is_admin() or (is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)))
  );
create policy bookings_insert_coach on bookings for insert to authenticated
  with check (
    tenant_id = current_tenant_id()
    and is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)
  );
create policy bookings_update on bookings for update to authenticated
  using (
    tenant_id = current_tenant_id()
    and (is_admin() or (is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)))
  )
  with check (
    tenant_id = current_tenant_id()
    and (is_admin() or (is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)))
  );
create policy bookings_delete on bookings for delete to authenticated
  using (
    tenant_id = current_tenant_id()
    and (is_admin() or (is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)))
  );

create policy subscriptions_select on subscriptions for select to authenticated
  using (tenant_id = current_tenant_id() and is_admin());
create policy invoices_select on invoices for select to authenticated
  using (tenant_id = current_tenant_id() and is_admin());
