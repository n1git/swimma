alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'coach', 'receptionist', 'finance'));

alter table profiles add column is_head_coach boolean not null default false;
alter table profiles add constraint profiles_head_coach_is_coach check (not is_head_coach or role = 'coach');

alter table classes add column substitute_id uuid references profiles(id);
create index classes_substitute_id_idx on classes(substitute_id);

create function is_receptionist() returns boolean as $$
  select current_app_role() = 'receptionist' and is_active_user();
$$ language sql stable;

create function is_finance() returns boolean as $$
  select current_app_role() = 'finance' and is_active_user();
$$ language sql stable;

create function is_head_coach() returns boolean as $$
  select is_coach() and exists (select 1 from profiles where id = auth.uid() and is_head_coach);
$$ language sql stable security definer set search_path = public;

revoke execute on function is_head_coach() from public, anon;
grant execute on function is_head_coach() to authenticated;

create or replace function coach_owns_class(p_class_id uuid) returns boolean as $$
  select exists (
    select 1 from classes cl
    join profiles p on p.id = auth.uid() and p.is_active
    where cl.id = p_class_id
      and cl.tenant_id = current_tenant_id()
      and coalesce(cl.substitute_id, cl.instructor_id) = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function coach_substitutes_class(p_class_id uuid) returns boolean as $$
  select exists (
    select 1 from classes cl
    join profiles p on p.id = auth.uid() and p.is_active
    where cl.id = p_class_id
      and cl.tenant_id = current_tenant_id()
      and cl.substitute_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function coach_substitutes_member(p_member_id uuid) returns boolean as $$
  select exists (
    select 1 from bookings b
    join classes cl on cl.id = b.class_id
    join profiles p on p.id = auth.uid() and p.is_active
    where b.member_id = p_member_id
      and cl.tenant_id = current_tenant_id()
      and cl.substitute_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function coach_owns_class(uuid) from public, anon;
revoke execute on function coach_substitutes_class(uuid) from public, anon;
revoke execute on function coach_substitutes_member(uuid) from public, anon;
grant execute on function coach_owns_class(uuid) to authenticated;
grant execute on function coach_substitutes_class(uuid) to authenticated;
grant execute on function coach_substitutes_member(uuid) to authenticated;

drop policy profiles_select_admin on profiles;
create policy profiles_select_staff on profiles for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_finance()));
create policy profiles_select_head_coach on profiles for select to authenticated
  using (tenant_id = current_tenant_id() and role = 'coach' and is_head_coach());

drop policy members_select on members;
drop policy members_insert on members;
drop policy members_update on members;

create policy members_select on members for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and (
      is_admin() or is_receptionist() or is_head_coach()
      or (is_coach() and (coach_id = auth.uid() or coach_substitutes_member(id)))
    )
  );
create policy members_insert on members for insert to authenticated
  with check (tenant_id = current_tenant_id() and (is_admin() or is_receptionist()));
create policy members_update on members for update to authenticated
  using (
    tenant_id = current_tenant_id()
    and (is_admin() or is_receptionist() or is_head_coach() or (is_coach() and coach_id = auth.uid()))
  )
  with check (
    tenant_id = current_tenant_id()
    and (is_admin() or is_receptionist() or is_head_coach() or (is_coach() and coach_id = auth.uid()))
  );

create or replace function enforce_coach_member_update() returns trigger as $$
declare
  v_allowed text[];
begin
  if is_receptionist() and new.is_active is distinct from old.is_active then
    raise exception 'receptionist may not change member status';
  end if;
  if is_coach() then
    v_allowed := case when is_head_coach()
      then array['notes', 'updated_at', 'coach_id']
      else array['notes', 'updated_at'] end;
    if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception 'coach may only change member notes';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create view member_names with (security_barrier = true) as
select id, tenant_id, full_name, is_active
from members
where tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_finance());

revoke all on member_names from anon, authenticated;
grant select on member_names to authenticated;

create or replace view report_member_counts with (security_invoker = true) as
select
  count(*) filter (where is_active) as active_members,
  count(*) filter (where not is_active) as inactive_members
from member_names;

create or replace view subscription_usage with (security_invoker = true) as
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
join member_names m on m.id = s.member_id
left join lateral (
  select count(*) as sessions_used
  from bookings b
  join classes cl on cl.id = b.class_id
  where b.member_id = s.member_id
    and b.is_attended
    and cl.start_time::date >= s.start_date
    and (s.end_date is null or cl.start_time::date <= s.end_date)
) bc on true;

create policy classes_update_head_coach on classes for update to authenticated
  using (tenant_id = current_tenant_id() and is_head_coach())
  with check (tenant_id = current_tenant_id() and is_head_coach());

create function enforce_head_coach_class_update() returns trigger as $$
begin
  if is_head_coach()
     and (to_jsonb(new) - array['substitute_id', 'updated_at'])
         is distinct from (to_jsonb(old) - array['substitute_id', 'updated_at']) then
    raise exception 'head coach may only change the substitute';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger classes_enforce_head_coach_update before update on classes
  for each row execute function enforce_head_coach_class_update();

create function enforce_class_substitute() returns trigger as $$
declare
  v_teacher uuid := coalesce(new.substitute_id, new.instructor_id);
begin
  if new.substitute_id is not null then
    if new.substitute_id = new.instructor_id then
      raise exception 'substitute must differ from the instructor';
    end if;
    if not exists (
      select 1 from profiles
      where id = new.substitute_id and role = 'coach' and is_active and tenant_id = new.tenant_id
    ) then
      raise exception 'substitute_id must reference an active coach in the same tenant';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('class-teacher:' || v_teacher::text));

  if exists (
    select 1 from classes c
    where c.id <> new.id
      and c.tenant_id = new.tenant_id
      and coalesce(c.substitute_id, c.instructor_id) = v_teacher
      and tstzrange(c.start_time, c.end_time, '[)') && tstzrange(new.start_time, new.end_time, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'coach already teaches another class at this time';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_class_substitute() from public, anon, authenticated;

create trigger classes_enforce_substitute before insert or update of substitute_id, instructor_id, start_time, end_time, tenant_id on classes
  for each row execute function enforce_class_substitute();

drop policy bookings_select on bookings;
drop policy bookings_update on bookings;
drop policy bookings_delete on bookings;

create policy bookings_select on bookings for select to authenticated
  using (
    tenant_id = current_tenant_id()
    and (
      is_admin() or is_receptionist() or is_head_coach()
      or (is_coach() and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id)))
    )
  );
create policy bookings_insert_receptionist on bookings for insert to authenticated
  with check (tenant_id = current_tenant_id() and is_receptionist());
create policy bookings_update on bookings for update to authenticated
  using (
    tenant_id = current_tenant_id()
    and (
      is_admin() or is_receptionist()
      or (is_coach() and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id)))
    )
  )
  with check (
    tenant_id = current_tenant_id()
    and (
      is_admin() or is_receptionist()
      or (is_coach() and ((coach_owns_class(class_id) and coach_owns_member(member_id)) or coach_substitutes_class(class_id)))
    )
  );
create policy bookings_delete on bookings for delete to authenticated
  using (
    tenant_id = current_tenant_id()
    and (is_admin() or is_receptionist() or (is_coach() and coach_owns_class(class_id) and coach_owns_member(member_id)))
  );

drop policy membership_packages_write_admin on membership_packages;
create policy membership_packages_write on membership_packages for all to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id())
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id());

drop policy subscriptions_select on subscriptions;
drop policy subscriptions_write_admin on subscriptions;
create policy subscriptions_select on subscriptions for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_finance()));
create policy subscriptions_write on subscriptions for all to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id())
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id());

drop policy invoices_select on invoices;
drop policy invoices_write_admin on invoices;
create policy invoices_select on invoices for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_finance() or is_receptionist()));
create policy invoices_write on invoices for all to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id())
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id());

drop policy cash_ledger_select_admin on cash_ledger;
drop policy cash_ledger_insert_admin on cash_ledger;
create policy cash_ledger_select on cash_ledger for select to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id());
create policy cash_ledger_insert on cash_ledger for insert to authenticated
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id());

drop policy payroll_runs_select_admin on payroll_runs;
drop policy payroll_runs_write_admin on payroll_runs;
create policy payroll_runs_select on payroll_runs for select to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id());
create policy payroll_runs_write on payroll_runs for all to authenticated
  using ((is_admin() or is_finance()) and tenant_id = current_tenant_id())
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id());

alter function enforce_subscriptions_tenant() security definer set search_path = public;
alter function enforce_invoices_tenant() security definer set search_path = public;
revoke execute on function enforce_subscriptions_tenant() from public, anon, authenticated;
revoke execute on function enforce_invoices_tenant() from public, anon, authenticated;

create or replace function mark_invoice_paid(p_invoice_id uuid) returns void as $$
declare
  v_amount numeric(12, 2);
  v_tenant_id uuid;
begin
  if not (is_admin() or is_finance() or is_receptionist()) then
    raise exception 'forbidden';
  end if;

  v_tenant_id := current_tenant_id();

  update invoices
  set status = 'paid', paid_at = now()
  where id = p_invoice_id and status = 'outstanding' and tenant_id = v_tenant_id
  returning amount into v_amount;

  if v_amount is null then
    raise exception 'invoice not found or already settled';
  end if;

  insert into cash_ledger (tenant_id, category, direction, amount, invoice_id, created_by)
  values (v_tenant_id, 'payment_received', 'in', v_amount, p_invoice_id, auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

create or replace function create_payroll_run(
  p_coach_id uuid,
  p_period_start date,
  p_period_end date,
  p_base_salary numeric,
  p_bonus numeric,
  p_thr numeric
) returns uuid as $$
declare
  v_run_id uuid;
  v_ledger_id uuid;
  v_total numeric;
  v_tenant_id uuid;
begin
  if not (is_admin() or is_finance()) then
    raise exception 'forbidden';
  end if;

  v_tenant_id := current_tenant_id();

  if not exists (
    select 1 from profiles where id = p_coach_id and role = 'coach' and tenant_id = v_tenant_id
  ) then
    raise exception 'coach not found in this tenant';
  end if;

  insert into payroll_runs (tenant_id, coach_id, period_start, period_end, base_salary, bonus, thr, status)
  values (v_tenant_id, p_coach_id, p_period_start, p_period_end, p_base_salary, p_bonus, p_thr, 'draft')
  returning id, total_amount into v_run_id, v_total;

  insert into cash_ledger (tenant_id, category, direction, amount, payroll_run_id, created_by)
  values (v_tenant_id, 'payroll', 'out', v_total, v_run_id, auth.uid())
  returning id into v_ledger_id;

  update payroll_runs
  set cash_ledger_entry_id = v_ledger_id, status = 'posted', posted_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function organization_internal_users(p_org uuid) returns int as $$
  select (
    (select count(*) from org_owners where organization_id = p_org and is_active)
    + (
      select count(*) from profiles p
      join tenants t on t.id = p.tenant_id
      where t.organization_id = p_org
        and p.owner_id is null
        and p.role in ('admin', 'coach', 'receptionist', 'finance')
        and p.is_active
    )
  )::int;
$$ language sql stable security definer set search_path = public;

create or replace function enforce_profile_billing() returns trigger as $$
declare
  v_org uuid;
begin
  if new.owner_id is not null or new.role not in ('admin', 'coach', 'receptionist', 'finance') or not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.owner_id is null and old.role in ('admin', 'coach', 'receptionist', 'finance') then
    return new;
  end if;
  select organization_id into v_org from tenants where id = new.tenant_id;
  perform enforce_billing_gate(v_org);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
