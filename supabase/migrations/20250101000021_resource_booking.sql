create table resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  location_id uuid not null references locations(id),
  name text not null,
  kind text not null default 'other' check (kind in ('court', 'lane', 'studio', 'room', 'floor', 'other')),
  capacity int not null default 1 check (capacity > 0 and capacity <= 1000),
  slot_minutes int not null default 60 check (slot_minutes > 0 and slot_minutes <= 480),
  price_per_slot numeric(12, 2) not null default 0 check (price_per_slot >= 0),
  advance_days int not null default 14 check (advance_days >= 0 and advance_days <= 365),
  cancel_hours int not null default 6 check (cancel_hours >= 0 and cancel_hours <= 720),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (location_id, name)
);

create index resources_tenant_id_idx on resources(tenant_id);

create function enforce_resource_refs() returns trigger as $$
begin
  if not exists (select 1 from locations where id = new.location_id and tenant_id = new.tenant_id) then
    raise exception 'location_id must belong to the same tenant';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger resources_enforce_refs before insert or update of location_id, tenant_id on resources
  for each row execute function enforce_resource_refs();

create table resource_hours (
  resource_id uuid not null references resources(id) on delete cascade,
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  weekday int not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  primary key (resource_id, weekday),
  check (closes > opens)
);

create function enforce_resource_hours_refs() returns trigger as $$
begin
  if not exists (select 1 from resources where id = new.resource_id and tenant_id = new.tenant_id) then
    raise exception 'resource_id must belong to the same tenant';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger resource_hours_enforce_refs before insert or update of resource_id, tenant_id on resource_hours
  for each row execute function enforce_resource_hours_refs();

alter table classes add column resource_id uuid references resources(id);
create index classes_resource_id_idx on classes(resource_id);

create table resource_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  resource_id uuid not null references resources(id),
  member_id uuid references members(id),
  guest_name text,
  guest_phone text,
  class_id uuid references classes(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  source text not null check (source in ('staff', 'member', 'class')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((member_id is not null)::int + (guest_name is not null)::int + (class_id is not null)::int = 1),
  check ((source = 'class') = (class_id is not null)),
  check (source <> 'member' or member_id is not null),
  check (guest_name is null or length(trim(guest_name)) > 0)
);

create index resource_bookings_resource_time_idx on resource_bookings(resource_id, start_time);
create index resource_bookings_tenant_time_idx on resource_bookings(tenant_id, start_time);
create index resource_bookings_member_time_idx on resource_bookings(member_id, start_time);
create unique index resource_bookings_class_idx on resource_bookings(class_id) where class_id is not null;

create function resource_max_overlap(p_resource uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns int as $$
  select coalesce(max(c), 0)::int from (
    select (
      select count(*) from resource_bookings b2
      where b2.resource_id = p_resource and b2.status = 'confirmed'
        and b2.id is distinct from p_exclude
        and b2.start_time <= pts.t and b2.end_time > pts.t
    ) as c
    from (
      select p_start as t
      union
      select b.start_time from resource_bookings b
      where b.resource_id = p_resource and b.status = 'confirmed'
        and b.id is distinct from p_exclude
        and b.start_time > p_start and b.start_time < p_end
    ) pts
  ) x;
$$ language sql stable security definer set search_path = public;

revoke execute on function resource_max_overlap(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

create function enforce_resource_booking() returns trigger as $$
declare
  r resources%rowtype;
  hrs resource_hours%rowtype;
  local_start timestamp;
  local_end timestamp;
  start_t time;
  end_t time;
  duration_min numeric;
  offset_min numeric;
begin
  select * into r from resources where id = new.resource_id for update;
  if r.id is null or r.tenant_id <> new.tenant_id then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if new.member_id is not null and not exists (
    select 1 from members where id = new.member_id and tenant_id = new.tenant_id
  ) then
    raise exception using errcode = 'RB008', message = 'Anggota tidak ditemukan';
  end if;

  if new.status <> 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed'
     and old.start_time = new.start_time and old.end_time = new.end_time and old.resource_id = new.resource_id then
    return new;
  end if;

  if new.source <> 'class' then
    local_start := new.start_time at time zone 'Asia/Jakarta';
    local_end := new.end_time at time zone 'Asia/Jakarta';
    if local_end::date > local_start::date and not (local_end::time = time '00:00' and local_end::date = local_start::date + 1) then
      raise exception using errcode = 'RB002', message = 'Booking tidak boleh melewati tengah malam';
    end if;
    select * into hrs from resource_hours where resource_id = r.id and weekday = extract(dow from local_start)::int;
    if hrs.resource_id is null then
      raise exception using errcode = 'RB002', message = 'Fasilitas tutup pada hari tersebut';
    end if;
    start_t := local_start::time;
    end_t := case when local_end::date > local_start::date then time '24:00:00' else local_end::time end;
    if start_t < hrs.opens or end_t > hrs.closes then
      raise exception using errcode = 'RB002', message = 'Waktu di luar jam buka fasilitas';
    end if;
    offset_min := extract(epoch from (start_t - hrs.opens)) / 60;
    duration_min := extract(epoch from (new.end_time - new.start_time)) / 60;
    if mod(offset_min, r.slot_minutes) <> 0 or mod(duration_min, r.slot_minutes) <> 0 then
      raise exception using errcode = 'RB002', message = 'Waktu tidak sesuai kelipatan slot fasilitas';
    end if;
  end if;

  if resource_max_overlap(r.id, new.start_time, new.end_time, new.id) >= r.capacity then
    if new.source = 'class' then
      raise exception using errcode = 'RB007', message = 'Fasilitas sudah terpakai pada waktu kelas ini. Pilih waktu atau fasilitas lain.';
    end if;
    raise exception using errcode = 'RB001', message = 'Slot sudah penuh. Pilih waktu lain.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_resource_booking() from public, anon, authenticated;

create trigger resource_bookings_enforce before insert or update of status, start_time, end_time, resource_id on resource_bookings
  for each row execute function enforce_resource_booking();

create function sync_class_resource_booking() returns trigger as $$
declare
  r resources%rowtype;
begin
  if new.resource_id is null then
    delete from resource_bookings where class_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.resource_id is not distinct from new.resource_id
     and not club_has_module(new.tenant_id, 'resource_booking') then
    return new;
  end if;

  select * into r from resources where id = new.resource_id;
  if r.id is null or r.tenant_id <> new.tenant_id or r.location_id <> new.location_id then
    raise exception using errcode = 'RB008', message = 'Fasilitas harus berada di lokasi kelas yang sama';
  end if;
  if not club_has_module(new.tenant_id, 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;

  update resource_bookings
  set resource_id = new.resource_id, start_time = new.start_time, end_time = new.end_time, status = 'confirmed'
  where class_id = new.id;
  if not found then
    insert into resource_bookings (tenant_id, resource_id, class_id, start_time, end_time, status, price, source)
    values (new.tenant_id, new.resource_id, new.id, new.start_time, new.end_time, 'confirmed', 0, 'class');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function sync_class_resource_booking() from public, anon, authenticated;

create trigger classes_sync_resource after insert or update of resource_id, start_time, end_time, location_id on classes
  for each row execute function sync_class_resource_booking();

alter table resources enable row level security;
alter table resource_hours enable row level security;
alter table resource_bookings enable row level security;

revoke all on resources, resource_hours, resource_bookings from anon, authenticated;
grant select, insert, update on resources to authenticated;
grant select, insert, update, delete on resource_hours to authenticated;
grant select on resource_bookings to authenticated;

create policy resources_select on resources for select to authenticated
  using (tenant_id = current_tenant_id());
create policy resources_insert_admin on resources for insert to authenticated
  with check (is_admin() and tenant_id = current_tenant_id());
create policy resources_update_admin on resources for update to authenticated
  using (is_admin() and tenant_id = current_tenant_id())
  with check (is_admin() and tenant_id = current_tenant_id());

create policy resource_hours_select on resource_hours for select to authenticated
  using (tenant_id = current_tenant_id());
create policy resource_hours_write_admin on resource_hours for all to authenticated
  using (is_admin() and tenant_id = current_tenant_id())
  with check (is_admin() and tenant_id = current_tenant_id());

create policy resource_bookings_select_staff on resource_bookings for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist()));
create policy resource_bookings_select_member on resource_bookings for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id());
create policy resource_bookings_select_coach on resource_bookings for select to authenticated
  using (tenant_id = current_tenant_id() and is_coach() and class_id is not null and coach_owns_class(class_id));

create function create_resource(
  p_location_id uuid,
  p_name text,
  p_kind text,
  p_capacity int,
  p_slot_minutes int,
  p_price_per_slot numeric,
  p_advance_days int,
  p_cancel_hours int,
  p_opens time,
  p_closes time
) returns uuid as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;

  insert into resources (tenant_id, location_id, name, kind, capacity, slot_minutes, price_per_slot, advance_days, cancel_hours)
  values (current_tenant_id(), p_location_id, trim(p_name), p_kind, p_capacity, p_slot_minutes, p_price_per_slot, p_advance_days, p_cancel_hours)
  returning id into v_id;

  insert into resource_hours (resource_id, tenant_id, weekday, opens, closes)
  select v_id, current_tenant_id(), d, p_opens, p_closes from generate_series(0, 6) d;

  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function set_resource_hours(p_resource_id uuid, p_hours jsonb) returns void as $$
begin
  if not is_admin() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not exists (select 1 from resources where id = p_resource_id and tenant_id = current_tenant_id()) then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  delete from resource_hours where resource_id = p_resource_id;
  insert into resource_hours (resource_id, tenant_id, weekday, opens, closes)
  select p_resource_id, current_tenant_id(), (h ->> 'weekday')::int, (h ->> 'opens')::time, (h ->> 'closes')::time
  from jsonb_array_elements(p_hours) h;
end;
$$ language plpgsql security definer set search_path = public;

create function resource_booking_insert(
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_member_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_source text
) returns uuid as $$
declare
  r resources%rowtype;
  v_slots numeric;
  v_id uuid;
begin
  select * into r from resources where id = p_resource_id and tenant_id = current_tenant_id() and is_active;
  if r.id is null then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if p_end <= p_start then
    raise exception using errcode = 'RB002', message = 'Waktu selesai harus setelah waktu mulai';
  end if;
  v_slots := extract(epoch from (p_end - p_start)) / 60 / r.slot_minutes;
  insert into resource_bookings (tenant_id, resource_id, member_id, guest_name, guest_phone, start_time, end_time, price, source, created_by)
  values (
    current_tenant_id(), r.id, p_member_id, nullif(trim(p_guest_name), ''), nullif(trim(p_guest_phone), ''),
    p_start, p_end, round(r.price_per_slot * v_slots, 2), p_source, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

create function book_resource(
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_member_id uuid default null,
  p_guest_name text default null,
  p_guest_phone text default null
) returns uuid as $$
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  if (p_member_id is not null) = (nullif(trim(coalesce(p_guest_name, '')), '') is not null) then
    raise exception using errcode = 'RB008', message = 'Pilih anggota atau isi nama tamu';
  end if;
  if p_end <= now() then
    raise exception using errcode = 'RB004', message = 'Waktu booking sudah lewat';
  end if;
  return resource_booking_insert(p_resource_id, p_start, p_end, p_member_id, p_guest_name, p_guest_phone, 'staff');
end;
$$ language plpgsql security definer set search_path = public;

create function book_resource_as_member(p_resource_id uuid, p_start timestamptz, p_end timestamptz) returns uuid as $$
declare
  v_member uuid;
  v_advance int;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not is_member() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  v_member := current_member_id();
  if not club_has_module(current_tenant_id(), 'resource_booking') or not club_has_module(current_tenant_id(), 'member_portal') then
    raise exception using errcode = 'RB003', message = 'Booking mandiri belum tersedia di klub ini';
  end if;
  if not exists (
    select 1 from subscriptions
    where member_id = v_member and status = 'active'
      and start_date <= v_today and (end_date is null or end_date >= v_today)
  ) then
    raise exception using errcode = 'RB006', message = 'Anda belum punya paket aktif';
  end if;
  select advance_days into v_advance from resources where id = p_resource_id and tenant_id = current_tenant_id();
  if v_advance is null then
    raise exception using errcode = 'RB008', message = 'Fasilitas tidak ditemukan';
  end if;
  if p_start <= now() or p_start > now() + make_interval(days => v_advance) then
    raise exception using errcode = 'RB004', message = format('Booking hanya bisa untuk waktu yang akan datang, maksimal %s hari ke depan', v_advance);
  end if;
  return resource_booking_insert(p_resource_id, p_start, p_end, v_member, null, null, 'member');
end;
$$ language plpgsql security definer set search_path = public;

create function cancel_booking(p_booking_id uuid) returns void as $$
declare
  b resource_bookings%rowtype;
  v_cancel_hours int;
  v_staff boolean := is_admin() or is_receptionist();
begin
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  select * into b from resource_bookings where id = p_booking_id and tenant_id = current_tenant_id() for update;
  if b.id is null then
    raise exception using errcode = 'RB008', message = 'Booking tidak ditemukan';
  end if;
  if not v_staff and not (is_member() and b.member_id = current_member_id()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if b.class_id is not null then
    raise exception using errcode = 'RB008', message = 'Booking kelas dikelola lewat jadwal kelas';
  end if;
  if b.status <> 'confirmed' then
    raise exception using errcode = 'RB008', message = 'Booking ini sudah tidak aktif';
  end if;
  if not v_staff then
    select cancel_hours into v_cancel_hours from resources where id = b.resource_id;
    if b.start_time - make_interval(hours => v_cancel_hours) < now() then
      raise exception using errcode = 'RB005', message = format('Pembatalan hanya bisa sampai %s jam sebelum mulai', v_cancel_hours);
    end if;
  end if;
  update resource_bookings set status = 'cancelled' where id = b.id;
end;
$$ language plpgsql security definer set search_path = public;

create function set_booking_status(p_booking_id uuid, p_status text) returns void as $$
declare
  b resource_bookings%rowtype;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  if p_status not in ('completed', 'no_show') then
    raise exception using errcode = 'RB008', message = 'Status tidak valid';
  end if;
  select * into b from resource_bookings where id = p_booking_id and tenant_id = current_tenant_id() for update;
  if b.id is null or b.class_id is not null or b.status <> 'confirmed' then
    raise exception using errcode = 'RB008', message = 'Booking tidak dapat diubah';
  end if;
  if b.start_time > now() then
    raise exception using errcode = 'RB008', message = 'Booking belum dimulai';
  end if;
  update resource_bookings set status = p_status where id = b.id;
end;
$$ language plpgsql security definer set search_path = public;

create function resource_availability(p_resource_id uuid, p_date date)
returns table (slot_start timestamptz, slot_end timestamptz, remaining int, bookable boolean, mine boolean) as $$
declare
  r resources%rowtype;
  hrs resource_hours%rowtype;
  v_member uuid := case when is_member() then current_member_id() end;
  v_is_member boolean := is_member();
begin
  if not is_active_user() then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'resource_booking') then
    raise exception using errcode = 'RB003', message = 'Modul Fasilitas & Booking tidak aktif untuk klub ini';
  end if;
  select * into r from resources where id = p_resource_id and tenant_id = current_tenant_id() and is_active;
  if r.id is null then
    return;
  end if;
  select * into hrs from resource_hours where resource_id = r.id and weekday = extract(dow from p_date)::int;
  if hrs.resource_id is null then
    return;
  end if;

  return query
  with slots as (
    select
      ((p_date + hrs.opens) + make_interval(mins => k * r.slot_minutes)) at time zone 'Asia/Jakarta' as s,
      ((p_date + hrs.opens) + make_interval(mins => (k + 1) * r.slot_minutes)) at time zone 'Asia/Jakarta' as e,
      (extract(epoch from hrs.opens) / 60 + (k + 1) * r.slot_minutes) as end_min
    from generate_series(0, 1440 / r.slot_minutes) k
  )
  select
    sl.s,
    sl.e,
    greatest(r.capacity - resource_max_overlap(r.id, sl.s, sl.e, null), 0),
    greatest(r.capacity - resource_max_overlap(r.id, sl.s, sl.e, null), 0) > 0
      and case
        when v_is_member then sl.s > now() and sl.s <= now() + make_interval(days => r.advance_days)
        else sl.e > now()
      end,
    v_member is not null and exists (
      select 1 from resource_bookings b
      where b.resource_id = r.id and b.member_id = v_member and b.status = 'confirmed'
        and b.start_time < sl.e and b.end_time > sl.s
    )
  from slots sl
  where sl.end_min <= extract(epoch from hrs.closes) / 60
  order by sl.s;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke execute on function create_resource(uuid, text, text, int, int, numeric, int, int, time, time) from public, anon;
revoke execute on function set_resource_hours(uuid, jsonb) from public, anon;
revoke execute on function resource_booking_insert(uuid, timestamptz, timestamptz, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function book_resource(uuid, timestamptz, timestamptz, uuid, text, text) from public, anon;
revoke execute on function book_resource_as_member(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function cancel_booking(uuid) from public, anon;
revoke execute on function set_booking_status(uuid, text) from public, anon;
revoke execute on function resource_availability(uuid, date) from public, anon;
grant execute on function create_resource(uuid, text, text, int, int, numeric, int, int, time, time) to authenticated;
grant execute on function set_resource_hours(uuid, jsonb) to authenticated;
grant execute on function book_resource(uuid, timestamptz, timestamptz, uuid, text, text) to authenticated;
grant execute on function book_resource_as_member(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function cancel_booking(uuid) to authenticated;
grant execute on function set_booking_status(uuid, text) to authenticated;
grant execute on function resource_availability(uuid, date) to authenticated;

update platform_modules set status = 'ready' where code = 'resource_booking';
