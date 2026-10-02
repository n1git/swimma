# Deploy checklist

Target: Supabase project `swimma` (Postgres 17) and the Vercel project. Nothing here touches Vercel; the Vercel steps are for the owner.

## 1. Database

Order matters: deploy the application code first, then apply migrations 012 and later (owners move to `org_owners`, parent role is removed, subscriptions move to the organization).

### Before migration 001: move pgcrypto

The hosted project ships `pgcrypto` in schema `extensions`. Migration 001 asks for `with schema public`, which is a no-op when the extension already exists, and migration 019 then fails (`function hmac(text, text, unknown) does not exist`) because `checkin_token_for` runs with `search_path = public`. Until the migration is fixed upstream, run once on an empty project:

```sql
alter extension pgcrypto set schema public;
```

Undo with `alter extension pgcrypto set schema extensions;` (only safe while no function created by the migrations is in use).

### Applying

- Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.
- SQL editor: paste each file of `supabase/migrations/` in numeric order, one at a time.
- Supabase MCP `apply_migration`: one file per call, sequential. Statements containing top-level `DROP` or `DELETE` (migrations 012, 013, 014, 016, 017, 018, 022) are held for interactive confirmation by the MCP and time out when nobody answers; use the CLI or SQL editor for those.

Migrations are not idempotent; apply each once. Do not edit an applied migration; add a new one.

### Status at the time of writing

| Range | State on the hosted project |
|---|---|
| 001-011 | Applied, in order, through the MCP (the version column holds timestamps, not the file numbers; align it if you later use `supabase db push`) |
| 012-023 | Not applied (blocked by the confirmation prompt described above) |

### After the last migration

1. `select count(*) from information_schema.tables where table_schema = 'public'` must equal the local count (39 tables) and every table must have RLS on.
2. Run the Supabase security and performance advisors; expect "extension in public" for `pgcrypto`, `btree_gist` and `pg_trgm`.
3. Create the first superadmin: `npm run seed:superadmin` with `SEED_SUPERADMIN_EMAIL` and `SEED_SUPERADMIN_PASSWORD` (12+ characters) and the service role key in the environment.

## 2. Environment variables (Vercel)

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings, API (legacy anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings, API (server only) |
| `SUPABASE_JWT_SECRET` | Project Settings, API, JWT Keys, legacy secret. The app signs its own HS256 tokens, so the legacy secret must stay enabled. |
| `CRON_SECRET` | Any long random string. It must be set: the cron route compares the header against `Bearer ${CRON_SECRET}`. |
| `NEXT_PUBLIC_APP_NAME` | Optional |

Vercel Authentication is on by default for the project; turn it off only when the site should be public.

## 3. Smoke test

1. Open `/` and confirm the pricing section lists Standard and Advanced (needs migration 014).
2. Register a club at `/daftar`, land on `/admin/onboarding`.
3. Log out, log in at `/login`, open `/admin`.
4. Log in at `/superadmin/login` with the seeded superadmin and activate the organization.
5. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/generate-invoices` returns `{"generated": n}`; without the header it returns 401.

## 4. Demo data

`npm run seed:demo` builds fake clubs through the real SQL functions (`register_organization`, `create_tenant_for_owner`, the RPCs). All organizations carry the `[DEMO]` prefix.

- Local, full scale (five organizations, a 5,000 member club): `DATABASE_URL=postgres://... npm run seed:demo`.
- Small set for the hosted project: `npm run seed:demo -- --hosted > demo.sql`, then run the file in the SQL editor. Passwords are generated per run and written to `audit/seed-credentials.json` (untracked).
- Remove demo data: `npm run seed:demo -- --purge --hosted > purge.sql`, run it in the SQL editor (it contains `DELETE` statements).
- Re-running the seed against a database that already holds `[DEMO]` organizations does nothing.

## 5. Rollback notes

No migration has a down script. The project is empty, so the practical rollback is to reset the database (Project Settings, Database, reset) and re-apply. Per migration, what would have to be reversed by hand:

| Migration | Reverse |
|---|---|
| 001 | `drop extension btree_gist, pg_trgm`; keep `pgcrypto` |
| 002-009 | drop the tables, functions and views it created (in reverse order of creation) |
| 010 | drop `superadmins`, `platform_plans`, `platform_subscriptions`, the plan triggers and `platform_tenant_usage` |
| 011 | drop `auth_rate_limits` and `hit_rate_limit`, drop `profiles.sessions_valid_after` |
| 012 | irreversible once data was backfilled (credentials move from `auth_credentials` to `org_owners`); restore from backup |
| 013 | irreversible (parent profiles and `parent_id` are deleted); restore from backup |
| 014 | drop the plan, subscription and module tables; the old billing tables are kept but unused |
| 015-023 | additive; drop the tables and columns they add (`coach_certifications`, staff roles, `member_accounts`, `club_types`, check-in, resources, orders) |
