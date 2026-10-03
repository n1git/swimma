do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('members', 'members_full_name_length', 'length(full_name) <= 200'),
      ('members', 'members_contact_name_length', 'contact_name is null or length(contact_name) <= 200'),
      ('members', 'members_notes_length', 'notes is null or length(notes) <= 2000'),
      ('members', 'members_address_length', 'address is null or length(address) <= 2000'),
      ('members', 'members_date_of_birth_range', 'date_of_birth between date ''1900-01-01'' and (now() at time zone ''Asia/Jakarta'')::date'),
      ('profiles', 'profiles_full_name_length', 'length(full_name) <= 200'),
      ('member_accounts', 'member_accounts_full_name_length', 'length(full_name) <= 200'),
      ('org_owners', 'org_owners_full_name_length', 'length(full_name) <= 200'),
      ('organizations', 'organizations_name_length', 'length(name) <= 200'),
      ('tenants', 'tenants_name_length', 'length(name) <= 200'),
      ('locations', 'locations_name_length', 'length(name) <= 200'),
      ('class_types', 'class_types_name_length', 'length(name) <= 200'),
      ('membership_packages', 'membership_packages_name_length', 'length(name) <= 200'),
      ('products', 'products_name_length', 'length(name) <= 200'),
      ('resources', 'resources_name_length', 'length(name) <= 200'),
      ('checkin_points', 'checkin_points_name_length', 'length(name) <= 200'),
      ('promo', 'promo_title_length', 'length(title) <= 200'),
      ('promo', 'promo_body_length', 'length(body) <= 2000'),
      ('promo', 'promo_active_range', 'active_until is null or active_until >= active_from'),
      ('bookings', 'bookings_notes_length', 'notes is null or length(notes) <= 2000'),
      ('cash_ledger', 'cash_ledger_reason_length', 'reason is null or length(reason) <= 2000'),
      ('orders', 'orders_void_reason_length', 'void_reason is null or length(void_reason) <= 2000')
    ) as t(tbl, name, expr)
  loop
    execute format('alter table %I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    begin
      execute format('alter table %I validate constraint %I', c.tbl, c.name);
    exception when check_violation then
      execute format('alter table %I drop constraint %I', c.tbl, c.name);
      raise warning 'constraint % not added: existing rows of % violate it', c.name, c.tbl;
    end;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1 from payroll_runs a
    join payroll_runs b on a.coach_id = b.coach_id and a.id < b.id
      and daterange(a.period_start, a.period_end, '[]') && daterange(b.period_start, b.period_end, '[]')
  ) then
    raise notice 'payroll_runs_no_overlap not added: overlapping periods exist';
  else
    alter table payroll_runs add constraint payroll_runs_no_overlap
      exclude using gist (coach_id with =, daterange(period_start, period_end, '[]') with &&);
  end if;
end;
$$;

create function enforce_booking_rules() returns trigger as $$
declare
  v_start timestamptz;
  v_day date;
begin
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(current_setting('swimma.late_attendance', true), '') = 'on' and is_admin() then
    perform log_audit('booking.late_attendance', 'booking', new.id,
      jsonb_build_object('class_id', new.class_id, 'member_id', new.member_id), new.tenant_id);
    return new;
  end if;
  select start_time into v_start from classes where id = new.class_id;
  if v_start <= now() then
    raise exception using errcode = 'BK001', message = 'Kelas sudah dimulai, anggota tidak bisa didaftarkan lagi';
  end if;
  v_day := (v_start at time zone 'Asia/Jakarta')::date;
  if not exists (
    select 1 from subscriptions
    where member_id = new.member_id and status = 'active'
      and start_date <= v_day and (end_date is null or end_date >= v_day)
  ) then
    raise exception using errcode = 'BK002', message = 'Anggota belum punya paket aktif untuk tanggal kelas ini';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_booking_rules() from public, anon, authenticated;

create trigger bookings_enforce_rules before insert on bookings
  for each row execute function enforce_booking_rules();

create function book_class(p_class_id uuid, p_member_id uuid, p_late_attendance boolean default false)
returns uuid as $$
declare
  v_id uuid;
  v_start timestamptz;
begin
  if p_late_attendance and not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if p_late_attendance then
    perform set_config('swimma.late_attendance', 'on', true);
  end if;
  select start_time into v_start from classes where id = p_class_id;
  insert into bookings (member_id, class_id, is_attended, attended_at)
  values (
    p_member_id,
    p_class_id,
    p_late_attendance and v_start <= now(),
    case when p_late_attendance and v_start <= now() then v_start end
  )
  returning id into v_id;
  perform set_config('swimma.late_attendance', '', true);
  return v_id;
end;
$$ language plpgsql set search_path = public;

revoke execute on function book_class(uuid, uuid, boolean) from public, anon;
grant execute on function book_class(uuid, uuid, boolean) to authenticated, service_role;
