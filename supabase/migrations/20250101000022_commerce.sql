insert into platform_modules (code, name, description, status, sort) values
  ('pos', 'Produk & Kasir', 'Produk, kasir, pesanan, dan pembayaran manual', 'soon', 11);

insert into club_type_modules (club_type, module_code) values
  ('swimming', 'pos'),
  ('gym', 'pos');

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  name text not null check (length(trim(name)) > 0),
  sku text,
  category text,
  price numeric(12, 2) not null check (price >= 0),
  track_stock boolean not null default false,
  stock_qty int not null default 0 check (stock_qty >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_tenant_id_idx on products(tenant_id);
create unique index products_sku_idx on products(tenant_id, sku) where sku is not null;

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  number text not null,
  member_id uuid references members(id),
  customer_name text,
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  total numeric(14, 2) not null default 0 check (total >= 0),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  unique (tenant_id, number)
);

create index orders_tenant_created_idx on orders(tenant_id, created_at desc);
create index orders_member_idx on orders(member_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  kind text not null check (kind in ('product', 'booking')),
  product_id uuid references products(id),
  booking_id uuid references resource_bookings(id),
  description text not null,
  qty int not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  stock_deducted boolean not null default false,
  check ((kind = 'product') = (product_id is not null)),
  check ((kind = 'booking') = (booking_id is not null)),
  check (kind <> 'booking' or qty = 1)
);

create index order_items_order_idx on order_items(order_id);
create index order_items_booking_idx on order_items(booking_id) where booking_id is not null;

create table order_counters (
  tenant_id uuid not null references tenants(id),
  year int not null,
  last_value int not null default 0,
  primary key (tenant_id, year)
);

alter table resource_bookings add column paid_at timestamptz;

alter table cash_ledger add column order_id uuid references orders(id);
alter table cash_ledger drop constraint cash_ledger_category_check;
alter table cash_ledger add constraint cash_ledger_category_check
  check (category in ('payment_received', 'payroll', 'manual_adjustment', 'order_payment'));
alter table cash_ledger drop constraint cash_ledger_traceable;
alter table cash_ledger add constraint cash_ledger_traceable check (
  (category = 'payment_received' and invoice_id is not null and payroll_run_id is null and order_id is null and direction = 'in')
  or (category = 'payroll' and payroll_run_id is not null and invoice_id is null and order_id is null and direction = 'out')
  or (category = 'order_payment' and order_id is not null and invoice_id is null and payroll_run_id is null and direction = 'in')
  or (category = 'manual_adjustment' and invoice_id is null and payroll_run_id is null and order_id is null
      and reason is not null and length(trim(reason)) > 0)
);

create index cash_ledger_order_idx on cash_ledger(order_id) where order_id is not null;

create table order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  method text not null check (method in ('cash', 'transfer', 'qris', 'other')),
  amount numeric(14, 2) not null check (amount > 0),
  reference text,
  ledger_entry_id uuid not null unique references cash_ledger(id),
  created_by uuid not null references profiles(id),
  paid_at timestamptz not null default now()
);

create index order_payments_order_idx on order_payments(order_id);

create or replace function enforce_cash_ledger_tenant() returns trigger as $$
begin
  if new.invoice_id is not null and not exists (
    select 1 from invoices where id = new.invoice_id and tenant_id = new.tenant_id
  ) then
    raise exception 'invoice_id must belong to the same tenant as the cash ledger entry';
  end if;
  if new.payroll_run_id is not null and not exists (
    select 1 from payroll_runs where id = new.payroll_run_id and tenant_id = new.tenant_id
  ) then
    raise exception 'payroll_run_id must belong to the same tenant as the cash ledger entry';
  end if;
  if new.order_id is not null and not exists (
    select 1 from orders where id = new.order_id and tenant_id = new.tenant_id
  ) then
    raise exception 'order_id must belong to the same tenant as the cash ledger entry';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger cash_ledger_enforce_tenant on cash_ledger;
create trigger cash_ledger_enforce_tenant before insert or update of invoice_id, payroll_run_id, order_id, tenant_id on cash_ledger
  for each row execute function enforce_cash_ledger_tenant();

drop policy cash_ledger_insert on cash_ledger;
create policy cash_ledger_insert on cash_ledger for insert to authenticated
  with check ((is_admin() or is_finance()) and tenant_id = current_tenant_id() and category = 'manual_adjustment');

alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_payments enable row level security;
alter table order_counters enable row level security;

revoke all on products, orders, order_items, order_payments, order_counters from anon, authenticated;
grant select, insert, update on products to authenticated;
grant select on orders, order_items, order_payments to authenticated;

create policy products_select on products for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_finance()));
create policy products_insert on products for insert to authenticated
  with check (is_admin() and tenant_id = current_tenant_id());
create policy products_update on products for update to authenticated
  using (is_admin() and tenant_id = current_tenant_id())
  with check (is_admin() and tenant_id = current_tenant_id());

create policy orders_select_staff on orders for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_finance()));
create policy orders_select_member on orders for select to authenticated
  using (tenant_id = current_tenant_id() and is_member() and member_id = current_member_id() and status = 'paid');

create policy order_items_select on order_items for select to authenticated
  using (tenant_id = current_tenant_id() and exists (select 1 from orders o where o.id = order_id));

create policy order_payments_select on order_payments for select to authenticated
  using (tenant_id = current_tenant_id() and (is_admin() or is_receptionist() or is_finance()));

create function next_order_number(p_tenant uuid) returns text as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Jakarta'))::int;
  v_value int;
begin
  insert into order_counters (tenant_id, year, last_value) values (p_tenant, v_year, 1)
  on conflict (tenant_id, year) do update set last_value = order_counters.last_value + 1
  returning last_value into v_value;
  return 'POS-' || v_year || '-' || lpad(v_value::text, 6, '0');
end;
$$ language plpgsql security definer set search_path = public;

create function order_record_payment(p_order uuid, p_method text, p_amount numeric, p_reference text) returns void as $$
declare
  o orders%rowtype;
  v_paid numeric;
  v_ledger uuid;
begin
  select * into o from orders where id = p_order;
  if p_method not in ('cash', 'transfer', 'qris', 'other') then
    raise exception using errcode = 'PS002', message = 'Metode pembayaran tidak valid';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'PS004', message = 'Jumlah pembayaran harus lebih dari 0';
  end if;
  select coalesce(sum(amount), 0) into v_paid from order_payments where order_id = p_order;
  if v_paid + p_amount > o.total then
    raise exception using errcode = 'PS004', message = 'Pembayaran melebihi sisa tagihan';
  end if;
  insert into cash_ledger (tenant_id, category, direction, amount, order_id, created_by)
  values (o.tenant_id, 'order_payment', 'in', p_amount, o.id, auth.uid())
  returning id into v_ledger;
  insert into order_payments (order_id, tenant_id, method, amount, reference, ledger_entry_id, created_by)
  values (o.id, o.tenant_id, p_method, p_amount, nullif(trim(coalesce(p_reference, '')), ''), v_ledger, auth.uid());
end;
$$ language plpgsql security definer set search_path = public;

create function order_settle(p_order uuid) returns void as $$
declare
  r record;
begin
  perform 1 from products
  where id in (select product_id from order_items where order_id = p_order and product_id is not null)
  order by id for update;

  for r in
    select p.id, p.name, p.stock_qty, sum(oi.qty)::int as q
    from order_items oi join products p on p.id = oi.product_id
    where oi.order_id = p_order and p.track_stock
    group by p.id, p.name, p.stock_qty
    order by p.id
  loop
    if r.stock_qty < r.q then
      raise exception using errcode = 'PS003', message = format('Stok %s tidak cukup (tersisa %s)', r.name, r.stock_qty);
    end if;
    update products set stock_qty = stock_qty - r.q where id = r.id;
  end loop;

  update order_items oi set stock_deducted = true
  from products p
  where p.id = oi.product_id and p.track_stock and oi.order_id = p_order;

  update resource_bookings set paid_at = now()
  where id in (select booking_id from order_items where order_id = p_order and booking_id is not null);

  update orders set status = 'paid', paid_at = now() where id = p_order;
end;
$$ language plpgsql security definer set search_path = public;

create function create_order(
  p_member_id uuid,
  p_customer_name text,
  p_items jsonb,
  p_payments jsonb default '[]'::jsonb
) returns uuid as $$
declare
  v_tenant uuid := current_tenant_id();
  v_order uuid;
  v_item jsonb;
  v_pay jsonb;
  v_kind text;
  v_qty int;
  p products%rowtype;
  b resource_bookings%rowtype;
  v_desc text;
  v_total numeric := 0;
  v_paid numeric := 0;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(v_tenant, 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'PS002', message = 'Pesanan harus berisi 1 sampai 100 item';
  end if;
  if p_member_id is not null and not exists (
    select 1 from members where id = p_member_id and tenant_id = v_tenant and is_active
  ) then
    raise exception using errcode = 'PS002', message = 'Anggota tidak ditemukan';
  end if;

  insert into orders (tenant_id, number, member_id, customer_name, created_by)
  values (v_tenant, next_order_number(v_tenant), p_member_id, nullif(trim(coalesce(p_customer_name, '')), ''), auth.uid())
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_kind := v_item ->> 'kind';
    v_qty := coalesce((v_item ->> 'qty')::int, 1);
    if v_qty < 1 or v_qty > 9999 then
      raise exception using errcode = 'PS002', message = 'Jumlah item tidak valid';
    end if;
    if v_kind = 'product' then
      select * into p from products
      where id = (v_item ->> 'product_id')::uuid and tenant_id = v_tenant and is_active;
      if p.id is null then
        raise exception using errcode = 'PS002', message = 'Produk tidak ditemukan atau nonaktif';
      end if;
      insert into order_items (order_id, tenant_id, kind, product_id, description, qty, unit_price, line_total)
      values (v_order, v_tenant, 'product', p.id, p.name, v_qty, p.price, round(p.price * v_qty, 2));
      v_total := v_total + round(p.price * v_qty, 2);
    elsif v_kind = 'booking' then
      select * into b from resource_bookings
      where id = (v_item ->> 'booking_id')::uuid and tenant_id = v_tenant for update;
      if b.id is null or b.status <> 'confirmed' or b.class_id is not null then
        raise exception using errcode = 'PS005', message = 'Booking tidak dapat ditagih';
      end if;
      if b.paid_at is not null or exists (
        select 1 from order_items oi join orders o on o.id = oi.order_id
        where oi.booking_id = b.id and o.status <> 'void'
      ) then
        raise exception using errcode = 'PS005', message = 'Booking sudah ada di pesanan lain';
      end if;
      if p_member_id is not null and b.member_id is not null and b.member_id <> p_member_id then
        raise exception using errcode = 'PS005', message = 'Booking milik anggota lain';
      end if;
      select 'Booking ' || r.name || ' ' || to_char(b.start_time at time zone 'Asia/Jakarta', 'DD Mon YYYY HH24:MI')
      into v_desc from resources r where r.id = b.resource_id;
      insert into order_items (order_id, tenant_id, kind, booking_id, description, qty, unit_price, line_total)
      values (v_order, v_tenant, 'booking', b.id, v_desc, 1, b.price, b.price);
      v_total := v_total + b.price;
    else
      raise exception using errcode = 'PS002', message = 'Jenis item tidak valid';
    end if;
  end loop;

  update orders set total = v_total where id = v_order;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' then
    for v_pay in select * from jsonb_array_elements(p_payments) loop
      perform order_record_payment(v_order, v_pay ->> 'method', (v_pay ->> 'amount')::numeric, v_pay ->> 'reference');
      v_paid := v_paid + (v_pay ->> 'amount')::numeric;
    end loop;
  end if;

  if v_paid = v_total then
    perform order_settle(v_order);
  end if;

  return v_order;
end;
$$ language plpgsql security definer set search_path = public;

create function add_order_payment(p_order_id uuid, p_method text, p_amount numeric, p_reference text default null)
returns text as $$
declare
  o orders%rowtype;
  v_paid numeric;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  select * into o from orders where id = p_order_id and tenant_id = current_tenant_id() for update;
  if o.id is null then
    raise exception using errcode = 'PS002', message = 'Pesanan tidak ditemukan';
  end if;
  if o.status <> 'open' then
    raise exception using errcode = 'PS002', message = 'Pesanan ini sudah tidak bisa dibayar';
  end if;
  perform order_record_payment(o.id, p_method, p_amount, p_reference);
  select coalesce(sum(amount), 0) into v_paid from order_payments where order_id = o.id;
  if v_paid = o.total then
    perform order_settle(o.id);
    return 'paid';
  end if;
  return 'open';
end;
$$ language plpgsql security definer set search_path = public;

create function void_order(p_order_id uuid) returns void as $$
declare
  o orders%rowtype;
  r record;
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  select * into o from orders where id = p_order_id and tenant_id = current_tenant_id() for update;
  if o.id is null then
    raise exception using errcode = 'PS002', message = 'Pesanan tidak ditemukan';
  end if;
  if o.status = 'void' then
    raise exception using errcode = 'PS006', message = 'Pesanan sudah dibatalkan';
  end if;
  if o.status = 'open' and exists (select 1 from order_payments where order_id = o.id) then
    raise exception using errcode = 'PS006', message = 'Pesanan dengan pembayaran sebagian tidak bisa dibatalkan. Lunasi dulu atau hubungi admin.';
  end if;

  if o.status = 'paid' then
    perform 1 from products
    where id in (select product_id from order_items where order_id = o.id and stock_deducted)
    order by id for update;
    for r in
      select product_id, sum(qty)::int as q from order_items
      where order_id = o.id and stock_deducted group by product_id order by product_id
    loop
      update products set stock_qty = stock_qty + r.q where id = r.product_id;
    end loop;
    update order_items set stock_deducted = false where order_id = o.id;

    insert into cash_ledger (tenant_id, category, direction, amount, reason, created_by)
    select o.tenant_id, 'manual_adjustment', 'out', amount, 'Pembatalan pesanan ' || o.number, auth.uid()
    from order_payments where order_id = o.id;

    update resource_bookings set paid_at = null
    where id in (select booking_id from order_items where order_id = o.id and booking_id is not null);
  end if;

  update orders set status = 'void', voided_at = now() where id = o.id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function next_order_number(uuid) from public, anon, authenticated;
revoke execute on function order_record_payment(uuid, text, numeric, text) from public, anon, authenticated;
revoke execute on function order_settle(uuid) from public, anon, authenticated;
revoke execute on function create_order(uuid, text, jsonb, jsonb) from public, anon;
revoke execute on function add_order_payment(uuid, text, numeric, text) from public, anon;
revoke execute on function void_order(uuid) from public, anon;
grant execute on function create_order(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function add_order_payment(uuid, text, numeric, text) to authenticated;
grant execute on function void_order(uuid) to authenticated;

update platform_modules set status = 'ready' where code = 'pos';
