revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke truncate, references, trigger on tables from anon, authenticated';
exception when others then
  null;
end;
$$;

do $$
declare
  f record;
begin
  for f in
    select p.oid, p.oid::regprocedure as sig,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok,
           has_function_privilege('service_role', p.oid, 'execute') as service_ok
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.auth_ok then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    if f.service_ok then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end;
$$;

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

do $$
begin
  execute 'alter default privileges for role supabase_admin revoke execute on functions from public';
  execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from public, anon';
exception when others then
  null;
end;
$$;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end;
$$;

revoke select on platform_plans, platform_subscriptions from anon, authenticated;
