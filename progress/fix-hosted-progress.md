# fix-hosted progress

## Status

- [x] Phase 0: preparation
- [ ] Phase 1: migrations and cron
- [ ] Phase 2: hosted setup (hosted pending, see below)
- [ ] Phase 3: docs and final checks

## Phase 0 result

- No `audit/` directory exists in this checkout, so minimal local probes are written for the items fixed here.
- Hosted: the Supabase account in this session lists one project, named `bugarswim`. No project named `swimma` is visible, so no hosted read or write was made. No `SUPABASE_ACCESS_TOKEN`, database URL or Supabase CLI is present in the environment.
- Local harness: PostgreSQL 16 with stub roles; a second layout with pgcrypto only in schema `extensions` is added for the proofs.
