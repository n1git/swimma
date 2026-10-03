create function pg_temp.wrap_helpers(p_expr text) returns text language sql immutable as $$
  select case when p_expr is null then null else
    regexp_replace(
      regexp_replace(
        p_expr,
        '(?<!SELECT )\m(auth\.uid|current_tenant_id|current_app_role|current_member_id|is_active_user|is_admin|is_coach|is_finance|is_receptionist|is_head_coach|is_member|current_profile_is_owner)\(\)',
        '(SELECT \1())',
        'g'
      ),
      '(?<!SELECT )\m(current_club_has_module\(''[a-z_]+''::text\))',
      '(SELECT \1)',
      'g'
    )
  end;
$$;

do $$
declare
  g record;
  p record;
  v_using text;
  v_check text;
  v_roles text;
  v_name text;
begin
  for g in
    select schemaname, tablename, cmd, roles
    from pg_policies
    where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd <> 'ALL'
    group by schemaname, tablename, cmd, roles
    having count(*) > 1
  loop
    select
      string_agg('(' || qual || ')', ' OR ' order by policyname) filter (where qual is not null),
      string_agg('(' || coalesce(with_check, qual) || ')', ' OR ' order by policyname) filter (where coalesce(with_check, qual) is not null)
    into v_using, v_check
    from pg_policies
    where schemaname = g.schemaname and tablename = g.tablename and cmd = g.cmd and roles = g.roles and permissive = 'PERMISSIVE';

    select string_agg(quote_ident(r), ', ') into v_roles from unnest(g.roles) r;
    v_name := g.tablename || '_' || lower(g.cmd);

    for p in
      select policyname from pg_policies
      where schemaname = g.schemaname and tablename = g.tablename and cmd = g.cmd and roles = g.roles and permissive = 'PERMISSIVE'
    loop
      execute format('drop policy %I on %I.%I', p.policyname, g.schemaname, g.tablename);
    end loop;

    execute format(
      'create policy %I on %I.%I as permissive for %s to %s%s%s',
      v_name, g.schemaname, g.tablename, g.cmd, v_roles,
      case when g.cmd in ('SELECT', 'UPDATE', 'DELETE') and v_using is not null then ' using (' || v_using || ')' else '' end,
      case when g.cmd in ('INSERT', 'UPDATE') and v_check is not null then ' with check (' || v_check || ')' else '' end
    );
  end loop;

  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    v_using := pg_temp.wrap_helpers(p.qual);
    v_check := pg_temp.wrap_helpers(p.with_check);
    if v_using is distinct from p.qual or v_check is distinct from p.with_check then
      execute format(
        'alter policy %I on %I.%I%s%s',
        p.policyname, p.schemaname, p.tablename,
        case when v_using is not null then ' using (' || v_using || ')' else '' end,
        case when v_check is not null then ' with check (' || v_check || ')' else '' end
      );
    end if;
  end loop;
end;
$$;

create index cash_ledger_created_by_idx on cash_ledger(created_by);
create index cash_ledger_invoice_idx on cash_ledger(invoice_id);
create index cash_ledger_payroll_run_idx on cash_ledger(payroll_run_id);
create index checkin_points_location_idx on checkin_points(location_id);
create index checkins_created_by_idx on checkins(created_by);
create index checkins_point_idx on checkins(point_id);
create index classes_class_type_idx on classes(class_type_id);
create index classes_location_idx on classes(location_id);
create index club_type_modules_module_idx on club_type_modules(module_code);
create index club_type_presets_club_type_idx on club_type_presets(club_type);
create index members_preferred_location_idx on members(preferred_location_id);
create index order_items_product_idx on order_items(product_id);
create index order_items_tenant_idx on order_items(tenant_id);
create index order_payments_created_by_idx on order_payments(created_by);
create index order_payments_tenant_idx on order_payments(tenant_id);
create index orders_created_by_idx on orders(created_by);
create index orders_voided_by_idx on orders(voided_by);
create index organization_subscriptions_plan_idx on organization_subscriptions(plan_code);
create index payroll_runs_ledger_entry_idx on payroll_runs(cash_ledger_entry_id);
create index platform_subscriptions_plan_idx on platform_subscriptions(plan_id);
create index promo_author_idx on promo(author_id);
create index resource_bookings_created_by_idx on resource_bookings(created_by);
create index resource_hours_tenant_idx on resource_hours(tenant_id);
create index subscriptions_package_idx on subscriptions(package_id);
create index tenant_module_overrides_changed_by_idx on tenant_module_overrides(changed_by);
create index tenant_module_overrides_module_idx on tenant_module_overrides(module_code);
create index tenants_club_type_idx on tenants(club_type);
create index members_tenant_name_idx on members(tenant_id, full_name);
create index invoices_tenant_due_idx on invoices(tenant_id, due_date desc);
create index subscriptions_tenant_start_idx on subscriptions(tenant_id, start_date desc);

create or replace view checkin_daily_counts with (security_invoker = true) as
select
  count(*) filter (
    where checked_in_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
  ) as visits_today,
  count(*) as visits_week
from checkins
where checked_in_at >= date_trunc('week', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';

create or replace view member_names with (security_barrier = true) as
select id, tenant_id, full_name, is_active
from members
where tenant_id = (select current_tenant_id())
  and ((select is_admin()) or (select is_receptionist()) or (select is_finance()));

create or replace view subscription_usage with (security_invoker = true) as
select
  s.id as subscription_id,
  s.tenant_id,
  s.member_id,
  m.full_name as member_name,
  mp.sessions_included,
  coalesce(bc.sessions_used, 0::bigint) as sessions_used,
  greatest(mp.sessions_included - coalesce(bc.sessions_used, 0::bigint), 0::bigint) as sessions_remaining,
  s.end_date,
  (s.end_date is not null and s.end_date < current_date) as is_expired
from subscriptions s
join membership_packages mp on mp.id = s.package_id and mp.pricing_mode = 'session_pack'
join member_names m on m.id = s.member_id
left join lateral (
  select case
    when (select current_club_has_module('checkin')) then (
      select count(*) from checkins c where c.subscription_id = s.id
    )
    else (
      select count(*)
      from bookings b
      join classes cl on cl.id = b.class_id
      where b.member_id = s.member_id
        and b.is_attended
        and cl.start_time::date >= s.start_date
        and (s.end_date is null or cl.start_time::date <= s.end_date)
    )
  end as sessions_used
) bc on true;
