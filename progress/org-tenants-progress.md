# org-tenants progress

Hierarchy: organization (owner) → tenants (klub) → coaches → members.

## Status

- [x] Phase 0: preparation and plan. OK received; defaults accepted; push only to `main`.
- [x] Phase 1: database, organizations
- [x] Phase 2: database, members
- [ ] Phase 3: auth and server
- [ ] Phase 4: UI
- [ ] Phase 5: cleanup and final checks

## Phase 0 findings

### Files touching parent / child / owns_child / is_parent / club code

Database: migrations 002 (children, enforce_children_parent_role, bookings.child_id, subscriptions, invoices, profiles.role), 003 (is_parent, owns_child, generate_invoices_for_period), 004 (all parent policies), 005 (report_member_counts), 006 (grants), 007 (search_similar_children), 009 (generate_invoices_for_period, session-pack triggers, subscription_usage), 010 (enforce_plan_member_limit, platform_tenant_usage), 011 (enforce_plan_member_limit).

Auth: `lib/auth/roles.ts`, `proxy.ts`, `lib/validations/auth.ts` (tenantSlug), `app/api/auth/login/route.ts`, `app/api/onboarding/register/route.ts`, `lib/validations/onboarding.ts` (tenantSlug).

Server: `lib/actions/{accounts,members,billing,schedule,promo}.ts`, `lib/data/{dashboard,lookups}.ts`, `lib/validations/{members,billing}.ts`.

UI: `app/parent/**` (delete), `app/admin/{members,schedule,billing/*,reports}/**`, `app/admin/{layout,page}.tsx`, `app/coach/attendance/[classId]/page.tsx`, `app/coach/layout.tsx`, `app/superadmin/(portal)/*`, `app/{page,layout,login,daftar}`, `components/members/*`, `components/attendance/attendance-roster.tsx`, `components/billing/subscription-form.tsx`, `components/schedule/add-booking-form.tsx`, `components/shared/{login-form,register-club-form,app-shell,auth-page-shell,nav-link}.tsx`.

Scripts/docs: `scripts/seed-admin.ts`, `README.md`, `KAJIAN_PAKET.md`, `CLAUDE.md`. `mvp/` references nothing of this app's Supabase schema; left alone.

### Plan

**Tables (migration 012+)**
- `organizations(id, name, max_tenants int not null default 3 check > 0, created_at, updated_at)`.
- `org_owners(id, organization_id, email unique lower, full_name, password_hash, is_active, failed_login_count, locked_until, last_login_at, created_at, updated_at)`. RLS on, no policies, all revoked from anon/authenticated. Service role only.
- `tenants.organization_id not null references organizations`.
- `profiles.owner_id uuid null references org_owners`; unique `(owner_id, tenant_id)`; check `owner_id is null or role = 'admin'`; trigger: owner's organization must equal tenant's organization.
- SW004 trigger on `tenants` insert: locks the organization row, counts its tenants, errors `SW004` at `max_tenants`.
- Atomic SQL functions (`security definer`, execute revoked from public/anon/authenticated, granted to service_role): `register_organization(...)` (org + owner + first tenant + owner admin profile + Trial subscription) and `create_tenant_for_owner(...)` (tenant + owner admin profile + Trial subscription). They replace the manual rollback code and guarantee a new tenant always has a subscription row.

**Email rules**
- Emails lowercased (check `email = lower(email)` on both tables).
- Unique `profiles(email) where owner_id is null`, plus triggers on `org_owners` and `profiles` rejecting an email that exists on the other table. Owner-linked admin profiles share the owner's email by design and are excluded.

**Existing rows (backfill)**
- One organization per existing tenant, name = tenant name. The oldest active admin of the tenant becomes the owner: hash, lockout state and `is_active` move from `auth_credentials` into `org_owners`; the profile gets `owner_id`; its `auth_credentials` row is removed after copy. Other admins stay as staff admins (own credentials).
- Same admin email in several tenants: one owner, one organization holding those tenants (needs your OK, see decisions).
- Coach emails that collide across tenants: migration aborts with a clear message listing them. Nothing is deleted or renamed automatically.
- Tenants without a subscription row are left alone.

**Members (renames and drops)**
- `children`→`members`, `child_id`→`member_id` in bookings/subscriptions/invoices, indexes, triggers, constraints. Rewritten: `enforce_booking_capacity`, `enforce_subscriptions_tenant`, `enforce_invoices_tenant`, `enforce_plan_member_limit` (SW001/SW003 kept), `generate_invoices_for_period`, `create_invoice_for_session_pack_subscription`, `search_similar_children`→`search_similar_members` (no parent join), views `report_member_counts` (`active_members`/`inactive_members`) and `subscription_usage` (`member_id`/`member_name`).
- Add `coach_id` (nullable, FK profiles; trigger: same tenant, role coach), `contact_name`, `contact_phone`. Copy parent `full_name`/`phone` into them, then drop `parent_id`, `enforce_children_parent_role`, `is_parent`, `owns_child`, every parent policy; delete parent profiles (credentials cascade); `profiles.role in ('admin','coach')`.
- Row counts of members, bookings, subscriptions, invoices verified equal before/after.

**Policies**
- `members`: admin all in tenant; coach select/update where `coach_id = auth.uid()`. A guard trigger lets a coach change only `notes`.
- `bookings`: admin all; coach select/insert/update/delete where `coach_owns_class(class_id)` and the member's `coach_id = auth.uid()`.
- `subscriptions`, `invoices`: admin only for select (parent branch removed). Promo: unchanged (admin write, everyone in tenant reads active).
- `organizations`: select for admin profiles whose current tenant belongs to it. `tenants` policy unchanged.
- `is_active_user()`: also requires the owner (if `owner_id` set) to be active. Deactivating the owner kills all their tenant sessions at once.

**Login lookup**
- `POST /api/auth/login`: rate limit, then `org_owners` by lowercase email. If none, `profiles` where `owner_id is null` by email + `auth_credentials`. Same generic error for unknown email, inactive, wrong password. Lockout and 15-minute rules reused for both stores.
- Owner: pick the oldest active tenant of the organization, mint JWT for that tenant's owner admin profile, redirect `/admin/klub` (org page). Coach: `/coach`. Suspended tenant message kept; if all owner tenants are suspended, same message.
- `switchTenant` server action: reads the session profile's `owner_id` from the DB, checks owner active, target tenant active and target profile has the same `owner_id`, then re-mints the JWT. No password prompt.
- Change password: owner updates `org_owners` and sets `sessions_valid_after` on all of the owner's profiles; others as today.

**JWT claims**
- `sub` (profile id), `app_role` (`admin`|`coach`), `tenant_id`, `org_id`, `email`, `full_name`. `org_id` is informational; every owner-only action re-derives owner and organization from the database.

**Owner-only code**
- `lib/auth/owner.ts` (`requireOwner`, `requireOwnerAction`) and `lib/data/organization.ts` are the only service-role readers of `org_owners` outside login. Owner pages live under `/admin/klub` (guarded by `requireOwner`) so the owner stays role `admin` in RLS.

**Superadmin**
- Views `platform_tenant_usage` (adds `organization_id`) and new `platform_organization_usage`. Portal groups tenants by organization, shows tenant count / `max_tenants`, and can raise `max_tenants` (service role action).

### Decisions I need from you (defaults listed; I proceed with them unless you say otherwise)

1. **Branch:** CLAUDE.md and your task say commit to `main`; this session is pinned to `claude/swimma-org-tenants-bk1kpc`. Default: commit on the session branch and push there, do not touch `main`. Say "main" to push to `main` instead.
2. `members.coach_id` nullable in the database (existing rows have no coach); required in the form. Unassigned members are visible to admins only.
3. Coach sees bookings only for their own members in their own classes (strict reading). A class with another coach's member is not fully visible on the roster.
4. Same admin email across several existing tenants collapses into one owner and one organization holding them. Colliding coach emails abort the migration.
5. Org page is `/admin/klub`, not a new route group or role.
6. Slug stays in the database (auto-generated from the club name with a suffix) but is no longer shown to users or used for login.
7. Owner-created tenants and new registrations get a `Trial` subscription through the SQL function; the 14 days still comes from `TRIAL_DAYS`.

### Known risks (not new work)
- Email-only login means anyone who knows an email can trigger the 15-minute lockout; per-IP rate limit still limits scale.
- Local DB verification uses the Postgres 16 binaries installed in this container; Supabase-specific objects (`auth.jwt()`, `storage.*`) will be stubbed for the check.

## Phase 1 done

- `supabase/migrations/20250101000012_organizations.sql`: organizations, org_owners, tenants.organization_id, profiles.owner_id, backfill, global email rules, SW004 trigger, `is_active_user` owner check, `register_organization` / `create_tenant_for_owner`, `platform_tenant_usage` (+`organization_id`) and `platform_organization_usage`.
- Applied locally (Postgres 16, stubbed Supabase roles/auth) on an empty DB and on 001-011 plus sample rows (case-mixed emails, one admin email in two tenants, tenant without admin). Backfill result checked.
- Note: the migration moves owner credentials into `org_owners`; the old login route cannot sign them in until Phase 3. Do not deploy the migration before Phase 3.
- Superadmin portal grouping by organization is a TS change, done in Phase 4.
- Check commands: `npx next typegen` is needed once so `LayoutProps` types exist; `npm run lint` fails only on pre-existing `.claude/skills/**/*.cjs` files, so lint is run as `npx eslint app components lib proxy.ts scripts` (clean).

## Phase 2 done

- `supabase/migrations/20250101000013_members.sql`: children→members, child_id→member_id (tables, indexes, constraints, triggers, functions, views), `coach_id`/`contact_*`, parent data copied then `parent_id`, parent profiles, `is_parent`, `owns_child`, `enforce_children_parent_role` removed, `profiles.role in ('admin','coach')`, new members/bookings/subscriptions/invoices policies, `coach_owns_member`, coach-only-notes trigger, `search_similar_members`.
- `enforce_booking_capacity` is now `security definer` (revoked from public) so a coach's capacity count is not cut by RLS.
- Checked locally: counts before/after equal (members 3, bookings 1, subscriptions 1, invoices 1); coach sees only own members/bookings and can change only notes; owner of A sees nothing of B; forged tenant claim sees 0; other org owner sees only theirs; anon denied; deactivated owner loses data access in all tenants; SW001 fires at the 76th active member on Starter.
- Note: the `tenants` select policy only checks `id = current_tenant_id()` (unchanged), so a deactivated owner's old JWT can still read its own tenant row; all data tables are blocked and the app guard redirects.
