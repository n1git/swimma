drop policy invoices_write on invoices;
drop policy payroll_runs_write on payroll_runs;

create function void_invoice(p_invoice_id uuid) returns void as $$
begin
  if not (is_admin() or is_finance()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  update invoices set status = 'void'
  where id = p_invoice_id and tenant_id = current_tenant_id() and status = 'outstanding';
  if not found then
    raise exception using errcode = 'IV001', message = 'Tagihan tidak ditemukan atau sudah lunas';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function void_invoice(uuid) from public, anon;
grant execute on function void_invoice(uuid) to authenticated, service_role;

create function protect_final_invoice() returns trigger as $$
begin
  if coalesce(current_setting('swimma.purge', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.status in ('paid', 'void') then
    raise exception using errcode = 'IV002', message = 'Tagihan yang sudah lunas atau dibatalkan tidak bisa diubah';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql set search_path = public;

create trigger invoices_protect_final before update or delete on invoices
  for each row execute function protect_final_invoice();

create function protect_posted_payroll() returns trigger as $$
begin
  if coalesce(current_setting('swimma.purge', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.status = 'posted' then
    raise exception using errcode = 'PR001', message = 'Gaji yang sudah dibukukan tidak bisa diubah';
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql set search_path = public;

create trigger payroll_runs_protect_posted before update or delete on payroll_runs
  for each row execute function protect_posted_payroll();

create function stamp_manual_ledger_entry() returns trigger as $$
begin
  if new.category = 'manual_adjustment' and auth.uid() is not null then
    new.created_by := auth.uid();
    new.entry_date := now();
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger cash_ledger_stamp_manual before insert on cash_ledger
  for each row execute function stamp_manual_ledger_entry();

create function enforce_same_tenant_refs() returns trigger as $$
declare
  v_col text;
  v_id uuid;
  v_row jsonb := to_jsonb(new);
begin
  foreach v_col in array tg_argv loop
    v_id := nullif(v_row ->> v_col, '')::uuid;
    continue when v_id is null;
    if v_col = 'cash_ledger_entry_id' then
      if not exists (select 1 from cash_ledger where id = v_id and tenant_id = new.tenant_id) then
        raise exception '% must belong to the same tenant', v_col;
      end if;
    elsif not exists (select 1 from profiles where id = v_id and tenant_id = new.tenant_id) then
      raise exception '% must belong to the same tenant', v_col;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_same_tenant_refs() from public, anon, authenticated;

create trigger promo_tenant_refs before insert or update of author_id on promo
  for each row execute function enforce_same_tenant_refs('author_id');
create trigger cash_ledger_tenant_refs before insert or update of created_by on cash_ledger
  for each row execute function enforce_same_tenant_refs('created_by');
create trigger payroll_runs_tenant_refs before insert or update of cash_ledger_entry_id on payroll_runs
  for each row execute function enforce_same_tenant_refs('cash_ledger_entry_id');
create trigger checkins_tenant_refs before insert or update of created_by on checkins
  for each row execute function enforce_same_tenant_refs('created_by');
create trigger orders_tenant_refs before insert or update of created_by on orders
  for each row execute function enforce_same_tenant_refs('created_by');
create trigger order_payments_tenant_refs before insert or update of created_by on order_payments
  for each row execute function enforce_same_tenant_refs('created_by');
create trigger resource_bookings_tenant_refs before insert or update of created_by on resource_bookings
  for each row execute function enforce_same_tenant_refs('created_by');
create trigger tenant_module_overrides_tenant_refs before insert or update of changed_by on tenant_module_overrides
  for each row execute function enforce_same_tenant_refs('changed_by');

alter table cash_ledger drop constraint cash_ledger_category_check;
alter table cash_ledger add constraint cash_ledger_category_check
  check (category in ('payment_received', 'payroll', 'manual_adjustment', 'order_payment', 'order_reversal'));
alter table cash_ledger drop constraint cash_ledger_traceable;
alter table cash_ledger add constraint cash_ledger_traceable check (
  (category = 'payment_received' and invoice_id is not null and payroll_run_id is null and order_id is null and direction = 'in')
  or (category = 'payroll' and payroll_run_id is not null and invoice_id is null and order_id is null and direction = 'out')
  or (category = 'order_payment' and order_id is not null and invoice_id is null and payroll_run_id is null and direction = 'in')
  or (category = 'order_reversal' and order_id is not null and invoice_id is null and payroll_run_id is null and direction = 'out'
      and reason is not null and length(trim(reason)) > 0)
  or (category = 'manual_adjustment' and invoice_id is null and payroll_run_id is null and order_id is null
      and reason is not null and length(trim(reason)) > 0)
);

alter table orders add column void_reason text, add column voided_by uuid references profiles(id);

drop function void_order(uuid);

create function void_order(p_order_id uuid, p_reason text) returns void as $$
declare
  o orders%rowtype;
  r record;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not (is_admin() or is_receptionist()) then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;
  if not club_has_module(current_tenant_id(), 'pos') then
    raise exception using errcode = 'PS001', message = 'Modul Produk & Kasir tidak aktif untuk klub ini';
  end if;
  if length(v_reason) < 5 then
    raise exception using errcode = 'PS007', message = 'Tulis alasan pembatalan, minimal 5 karakter';
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
  if not is_admin() and o.status = 'paid'
     and (o.paid_at at time zone 'Asia/Jakarta')::date <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = 'PS008', message = 'Resepsionis hanya bisa membatalkan pesanan yang lunas hari ini. Hubungi admin.';
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

    insert into cash_ledger (tenant_id, category, direction, amount, order_id, reason, created_by)
    select o.tenant_id, 'order_reversal', 'out', amount, o.id, 'Pembatalan pesanan ' || o.number || ': ' || v_reason, auth.uid()
    from order_payments where order_id = o.id;

    update resource_bookings set paid_at = null
    where id in (select booking_id from order_items where order_id = o.id and booking_id is not null);
  end if;

  update orders set status = 'void', voided_at = now(), void_reason = v_reason, voided_by = auth.uid() where id = o.id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function void_order(uuid, text) from public, anon;
grant execute on function void_order(uuid, text) to authenticated, service_role;

create or replace function generate_invoices_for_period(
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_tenant_id uuid default null
) returns setof invoices as $$
begin
  if p_tenant_id is not null then
    perform enforce_billing_gate((select organization_id from tenants where id = p_tenant_id));
  end if;
  return query
  insert into invoices (tenant_id, member_id, subscription_id, amount, due_date, period_start, period_end)
  select s.tenant_id, s.member_id, s.id, mp.price, p_due_date, p_period_start, p_period_end
  from subscriptions s
  join membership_packages mp on mp.id = s.package_id
  join members m on m.id = s.member_id
  join tenants t on t.id = s.tenant_id
  left join organization_subscriptions os on os.organization_id = t.organization_id
  where s.status = 'active'
    and mp.pricing_mode = 'cycle'
    and m.is_active
    and t.is_active
    and (
      os.status is null
      or os.status = 'active'
      or (os.status = 'trial' and os.trial_ends_at >= (now() at time zone 'Asia/Jakarta')::date)
    )
    and s.start_date <= p_period_end
    and (s.end_date is null or s.end_date >= p_period_start)
    and (p_tenant_id is null or s.tenant_id = p_tenant_id)
  on conflict (subscription_id, period_start) do nothing
  returning *;
end;
$$ language plpgsql security definer set search_path = public;

create function pause_subscriptions_on_member_deactivation() returns trigger as $$
begin
  update subscriptions set status = 'paused' where member_id = new.id and status = 'active';
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function pause_subscriptions_on_member_deactivation() from public, anon, authenticated;

create trigger members_pause_subscriptions after update of is_active on members
  for each row when (old.is_active and not new.is_active)
  execute function pause_subscriptions_on_member_deactivation();

create function enforce_tenant_billing_gate() returns trigger as $$
begin
  perform enforce_billing_gate((select organization_id from tenants where id = new.tenant_id));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_tenant_billing_gate() from public, anon, authenticated;

create trigger bookings_enforce_billing before insert on bookings
  for each row execute function enforce_tenant_billing_gate();
create trigger resource_bookings_enforce_billing before insert on resource_bookings
  for each row execute function enforce_tenant_billing_gate();
create trigger orders_enforce_billing before insert on orders
  for each row execute function enforce_tenant_billing_gate();
create trigger checkins_enforce_billing before insert on checkins
  for each row execute function enforce_tenant_billing_gate();
create trigger classes_enforce_billing before insert on classes
  for each row execute function enforce_tenant_billing_gate();
create trigger payroll_runs_enforce_billing before insert on payroll_runs
  for each row execute function enforce_tenant_billing_gate();
