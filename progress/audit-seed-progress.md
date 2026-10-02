# audit-seed progress

Status and counts only. Findings, evidence and exploit details stay in the untracked `audit/` directory.

## Status

- [x] Phase 0: preparation. OK received.
- [~] Phase 1: environment (migrations, hosted project, fake data). Local part in progress. Hosted part blocked after migration 011, see below.
- [ ] Phase 2: audit, database and authorization
- [ ] Phase 3: audit, application security
- [ ] Phase 4: audit, logic, data integrity, UX, performance
- [ ] Phase 5: report

## Phase 0 result

Repo state audited: `main` at `bd2b664` plus the progress commit. Migrations 001-023, 39 public tables, 61 security definer functions, 8 route handlers.

Hosted target, verified read-only:

- Project named `swimma`, region ap-northeast-1, Postgres 17.6, status healthy. No project named `bugarswim` is visible to this account and none was touched.
- `public` schema empty (0 relations, 0 functions), 0 migrations recorded, 0 auth users, 0 storage buckets.
- Access method: Supabase MCP (read-only SQL, migrations, advisors). The service role key and the JWT secret are not available through it.
- JWT: a legacy HS256 anon key is present and enabled, so the legacy secret exists; its value must be copied from the dashboard by the owner for Vercel (see `docs/DEPLOY.md` once written).
- Local mirror: PostgreSQL 17.11 installed, plus PostgreSQL 16 stubs used earlier. Docker daemon and Supabase CLI are not available, so Supabase services are stubbed locally.

Migration plan for the hosted project: apply `20250101000001` to `20250101000023` in order through `apply_migration`, one file per call, then compare the migration list and schema with the local PG17 result, check RLS on every public table, run the security and performance advisors, then seed the small `[DEMO]` set through SQL.

Blocker found in Phase 0: the plan cannot run unchanged. One migration fails on the hosted project's layout (verified on a local PG17 mirror). A workaround that does not edit any migration exists and needs your OK because it changes the hosted project outside the migrations. Details are in `audit/10-static-notes.md`.

## Phase 1 hosted status

- OK received for the pgcrypto workaround and SQL-based seeding. Both done as agreed (pgcrypto moved to `public`; migrations 001-011 applied in order through the Supabase MCP, one call per file).
- Blocked at 012: the Supabase MCP never executes SQL containing top-level destructive statements (DROP, DELETE); the call hangs until the 60 s tool timeout and nothing is applied. Migrations 012-014, 016-018 and 022 contain them. Not worked around by obfuscating the statements.
- Hosted is therefore at 001-011 (empty, old schema, no data). To finish it I need one of: interactive confirmation of each prompt, a personal access token (`SUPABASE_ACCESS_TOKEN`) so the Management API can be used over HTTPS, or a direct database connection string.
- Everything else (local PG17 build, seed tooling, all audit phases) proceeds locally.

## Findings by severity

Not counted yet.
