alter table club_type_presets add column default_capacity int not null default 1 check (default_capacity > 0 and default_capacity <= 1000);

update club_type_presets set default_capacity = 4 where club_type = 'swimming' and kind = 'lane';
update club_type_presets set default_capacity = 20 where club_type = 'gym' and kind = 'floor';

insert into club_types (code, name, status, sort, terms) values
  ('tennis', 'Klub Tenis', 'ready', 3, jsonb_build_object(
    'member', 'Anggota', 'coach', 'Pelatih', 'visit', 'Kunjungan',
    'resource', 'Lapangan', 'session', 'Sesi', 'location', 'Lokasi Lapangan')),
  ('padel', 'Klub Padel', 'ready', 4, jsonb_build_object(
    'member', 'Anggota', 'coach', 'Pelatih', 'visit', 'Kunjungan',
    'resource', 'Lapangan', 'session', 'Sesi', 'location', 'Lokasi Lapangan')),
  ('pilates', 'Studio Pilates', 'ready', 5, jsonb_build_object(
    'member', 'Anggota', 'coach', 'Instruktur', 'visit', 'Kunjungan',
    'resource', 'Studio', 'session', 'Kelas', 'location', 'Lokasi Studio')),
  ('yoga', 'Studio Yoga', 'ready', 6, jsonb_build_object(
    'member', 'Anggota', 'coach', 'Instruktur', 'visit', 'Kunjungan',
    'resource', 'Studio', 'session', 'Kelas', 'location', 'Lokasi Studio')),
  ('crossfit', 'CrossFit', 'soon', 7, '{}'::jsonb),
  ('martial_arts', 'Bela Diri', 'soon', 8, '{}'::jsonb),
  ('dance', 'Studio Dance', 'soon', 9, '{}'::jsonb),
  ('badminton', 'Klub Badminton', 'soon', 10, '{}'::jsonb),
  ('futsal', 'Klub Futsal', 'soon', 11, '{}'::jsonb),
  ('basketball', 'Klub Basket', 'soon', 12, '{}'::jsonb),
  ('other', 'Lainnya', 'soon', 13, '{}'::jsonb);

insert into club_type_modules (club_type, module_code)
select t.code, m.code
from club_types t
cross join platform_modules m
where t.code in ('tennis', 'padel', 'pilates', 'yoga')
  and (m.code in ('members', 'plans', 'billing', 'cash_ledger', 'payroll', 'promo', 'member_portal', 'resource_booking', 'pos')
       or (t.code in ('pilates', 'yoga') and m.code = 'classes'));

insert into club_type_presets (club_type, kind, name_pattern, default_count, slot_minutes, default_capacity, sort) values
  ('tennis', 'court', 'Lapangan Tenis {n}', 2, 60, 1, 1),
  ('padel', 'court', 'Lapangan Padel {n}', 2, 60, 1, 1),
  ('pilates', 'studio', 'Studio {n}', 1, 60, 12, 1),
  ('yoga', 'studio', 'Studio {n}', 1, 60, 20, 1);

create function resource_utilization(p_from date, p_to date) returns numeric as $$
  with avail as (
    select coalesce(sum(r.capacity * extract(epoch from (h.closes - h.opens)) / 60), 0) as a
    from generate_series(p_from, p_to, interval '1 day') d
    join resource_hours h on h.weekday = extract(dow from d)::int
    join resources r on r.id = h.resource_id and r.is_active
  ),
  used as (
    select coalesce(sum(extract(epoch from (
      least(b.end_time, (p_to + 1)::timestamp at time zone 'Asia/Jakarta')
      - greatest(b.start_time, p_from::timestamp at time zone 'Asia/Jakarta')
    )) / 60), 0) as u
    from resource_bookings b
    join resources r on r.id = b.resource_id and r.is_active
    where b.status in ('confirmed', 'completed')
      and b.start_time < (p_to + 1)::timestamp at time zone 'Asia/Jakarta'
      and b.end_time > p_from::timestamp at time zone 'Asia/Jakarta'
  )
  select case when avail.a = 0 then null else round(least(used.u / avail.a, 1) * 100, 1) end
  from avail, used;
$$ language sql stable security invoker set search_path = public;

revoke execute on function resource_utilization(date, date) from public, anon;
grant execute on function resource_utilization(date, date) to authenticated;
