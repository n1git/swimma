# fix-hosted progress

## Status

- [x] Phase 0: preparation
- [x] Phase 1: migrations and cron
- [ ] Phase 2: hosted setup (hosted pending, see below)
- [ ] Phase 3: docs and final checks

## Phase 0 result

- No `audit/` directory exists in this checkout, so minimal local probes are written for the items fixed here.
- Hosted: the Supabase account in this session lists one project, named `bugarswim`. No project named `swimma` is visible, so no hosted read or write was made. No `SUPABASE_ACCESS_TOKEN`, database URL or Supabase CLI is present in the environment.
- Local harness: PostgreSQL 16 with stub roles; a second layout with pgcrypto only in schema `extensions` is added for the proofs.

## Phase 1 done

- Migration 019 edited in place (never applied on hosted): the secret default no longer calls a schema-dependent function and `checkin_token_for` runs with `search_path = public, extensions`. All migrations apply on an empty database with pgcrypto only in `extensions` and with pgcrypto in `public`.
- New migration `20250101000024_privilege_hardening.sql`: table privileges, function execute grants, fixed `search_path` on every function without one, legacy plan tables closed to client roles (kept, because later migrations reference them). Default privileges adjusted for new tables and functions.
- Cron route: rejects when the secret is unset or empty, constant-time comparison.
- Local proofs on a layout with hosted-like default privileges: catalog counts before and after the migration, function and policy behavior tests unchanged (diff empty against the run without 024), cron cases (unset, empty, wrong, right secret).
