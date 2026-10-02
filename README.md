# Swimma

Multi-tenant swimming club management platform: membership, scheduling,
attendance, billing, cash ledger, coach payroll, and promo announcements, for
owner/admin/coach roles. One deployment serves many organizations, each
owning one or more independent clubs (tenants) with isolated data and
branding. Members (swimmers) have no login.

Stack: Next.js (App Router) + TypeScript, Supabase Postgres with Row Level
Security, Tailwind CSS, Vercel deployment.

## Multi-tenancy model

Hierarchy: **organization (owner account) → tenants (clubs) → coaches →
members**. An organization (`organizations`) has one or more owners
(`org_owners`) and as many clubs as its plan allows (Standard 3 unless a
superadmin sets `club_limit_override`, Advanced unlimited; trigger error
`SW004`).

Every club is a row in `tenants` with a mandatory `organization_id`. All
club-owned data (profiles, locations, class types, members, classes, bookings, packages, subscriptions, invoices,
cash ledger, payroll, promo) carries a `tenant_id` and is isolated by
Postgres Row Level Security — the database, not the frontend, is the
isolation boundary. `current_tenant_id()` reads the tenant id embedded in the
caller's session JWT, and every RLS policy filters by it; cross-tenant
foreign key references (e.g. a booking's member and class must belong to the
same tenant) are additionally rejected by trigger checks at write time.

A profile belongs to exactly one tenant with one role (`admin` or `coach`).
Each member has one primary coach (`members.coach_id`, same tenant, role
coach) plus plain-text `contact_name` / `contact_phone`. Coaches see only
their own members and classes. An email is unique across owners and coach
profiles (database-enforced), so a coach belongs to one club only. A club's own name, logo, and primary color live in
`tenants` and are edited from Admin -> Pengaturan; they are not environment
variables.

## Auth model

Authentication is **custom** (bcrypt password hashes in `auth_credentials` for coaches
and in `org_owners` for owners), not Supabase Auth. There is one `/login`
(email + password, no club code). The server looks the email up in
`org_owners` first, then in `member_accounts`, then in coach/staff profiles, with the same generic error
for unknown email and wrong password, plus per-IP rate limit and a 15-minute
lockout after 5 failures. It then mints its own JWT signed with the Supabase
project's JWT secret, carrying `sub` (profile id), `tenant_id`, `org_id` and
`app_role` (admin/coach).

An owner has no tenant-specific password: each owner gets one `admin`
profile per club (`profiles.owner_id`) and signs in as the profile of their
default club, landing on `/admin/klub` (club list with member and coach
counts, "Tambah klub"). The tenant switcher re-mints the JWT for the owner's
admin profile in another club after checking `owner_id` in the database, with
no second password prompt. The owner is not an RLS role: RLS still sees a
tenant `admin`. Deactivating an owner (`org_owners.is_active`) removes access
to all their clubs at once; changing the owner password revokes every
owner session (`sessions_valid_after`). Coaches go to `/coach`.
`/superadmin/login` stays a separate URL with its own isolated session.

**Members** (swimmers) can sign in too, read-only, once a club has activated
their account (module `member_portal`). One person has one account in
`member_accounts`; each club membership is a `profiles` row with role
`member` (`profiles.member_account_id`) linked from `members.profile_id`.
After login, one club goes to `/member`; several go to `/member/klub` to
choose (the session carries `club_pending` until they do, so no club data is
shown first), and `switchClub` re-mints the JWT after checking
`member_account_id` in the database. RLS for role `member` only selects the
member's own `members`, `subscriptions`, `invoices` and `bookings` rows plus
the tenant-wide classes and active promo; there is no write policy, and
deactivating the member account cuts every club while deactivating the
`members` row cuts only that club.

**Identity rule:** one email is one kind of identity (owner, coach/staff
admin, or member account), enforced by triggers on all three stores. A coach
or owner therefore cannot also be a member with the same email. One account
has at most one member profile per club (a parent using one email for two
children in the same club cannot activate both). That JWT is stored in an
httpOnly cookie and attached as the `Authorization` header on every Supabase
request, so Postgres RLS (`auth.uid()`, `auth.jwt()`) enforces both role and
tenant scoping exactly as it would with Supabase Auth.

**Before running migrations against a real project**, check Project
Settings → API → JWT Keys. This setup requires the legacy shared **HS256
JWT secret** to be available (`SUPABASE_JWT_SECRET`). If a project only has
asymmetric JWT signing keys enabled and no legacy secret, self-minted HS256
tokens won't validate against PostgREST — in that case use Supabase's
Third-Party Auth (JWKS) support instead of `lib/auth/jwt.ts` as written.

The service-role key is used only in a few narrow, reviewed places (never in
client-reachable code): login lookup, owner reads of `org_owners` and the
organization overview, creating a coach account together with its
credentials row, the `register_organization` / `create_tenant_for_owner`
functions (execute granted to `service_role` only), the monthly invoice-generation cron and
its "generate now" admin button. Every other read/write goes through the
per-request JWT-bound client, so RLS is the real security boundary. Every
service-role write to a tenant-scoped table passes `tenant_id` explicitly
(the service-role client has no session JWT for `current_tenant_id()` to
read).

Deactivating an account (`profiles.is_active = false`) cuts off all DB
access immediately, even though its JWT technically hasn't expired — this is
enforced inside the `is_admin()` / `is_coach()` SQL helper
functions, not just in individual policies.

## Local setup

1. Create a Supabase project.
2. Enable extensions `pgcrypto`, `btree_gist`, `pg_trgm` (the first migration
   does this automatically if the project allows it).
3. Apply the SQL migrations in `supabase/migrations/` in order (via the
   Supabase CLI, `supabase db push`, or pasting them into the SQL editor in
   order).
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project
     Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API (server-only,
     never expose to the client).
   - `SUPABASE_JWT_SECRET` — Project Settings → API → JWT Keys (legacy
     secret; see the note above).
   - `CRON_SECRET` — any random string; Vercel Cron sends it automatically
     as a bearer token once set as an env var on the project.
   - `NEXT_PUBLIC_APP_NAME` — optional; the platform name shown before a
     club is selected (login screen, browser tab). Defaults to "Swimma".
5. Onboard the first organization, its owner and first club:
   ```bash
   SEED_TENANT_NAME="My Club" \
   SEED_ADMIN_EMAIL=owner@example.com SEED_ADMIN_PASSWORD=ChangeMe123 \
   npm run seed:admin
   ```
   Optional: `SEED_ORGANIZATION_NAME`, `SEED_PLAN` (`standard` or
   `advanced`, default `standard`), `SEED_PERIOD` (`monthly` or `yearly`).
6. `npm run dev` and log in at `/login` with the email and password.

## Deploying to Vercel

Create a Vercel project linked to this repo, set the same environment
variables there, and deploy. `vercel.json` already schedules the monthly
invoice-generation cron (`/api/cron/generate-invoices`, 1st of each month),
which generates invoices for every active tenant in one run.

## Onboarding a new club

Because isolation is enforced at the database level (RLS + `tenant_id`),
new clubs are onboarded onto the **same** deployment and Supabase project —
no new Supabase project or Vercel deployment needed. Two ways in:

- **Self-service** (`/daftar`): enter club name and your own
  name/email/password. One database call (`register_organization`) creates
  the organization, subscription (chosen plan and period; Standard starts a
  30-day `trial`, Advanced starts `pending`), owner, first club and owner
  admin profile, so nothing is left half-created. The owner lands on
  `/admin/klub`.
- **More clubs**: the owner adds clubs from `/admin/klub` ("Tambah klub",
  `create_tenant_for_owner`), within the plan's club limit.
- **Manual** (`npm run seed:admin` with `SEED_TENANT_NAME` and optionally
  `SEED_ORGANIZATION_NAME`) uses the same function.
- **Member accounts**: an admin (or a coach for their own members) opens a
  member and uses "Aktifkan akun" with the member's email
  (`activate_member_account`). A new email creates the account with a
  temporary password shown once (`must_change_password`); an email that
  already has an account is linked to the new club without touching its
  password ("Akun sudah ada, anggota login dengan kata sandinya"). Known
  limits: this reveals that the email already has an account; a temporary
  password known to one club's staff stays valid until the person's first
  login; "Atur ulang kata sandi" is refused when the account also belongs to
  another club. There is no invitation or reset by email.

Organizations that existed before the billing migration were backfilled
(see migration `20250101000014_org_billing.sql`): Advanced if any old plan was
unlimited, otherwise Standard, with the highest old status; organizations
without any old subscription became Advanced + active. The owner then sets club name/logo/color from Admin -> Pengaturan.

## Club types, modules and gym check-in

Every club has a type (`tenants.club_type`, chosen when the club is created
in `/daftar` or "Tambah klub"; `swimming` and `gym` are ready). A type lists
its modules in `club_type_modules`; a club has a module when its type lists
it and `platform_modules.status` is `ready` (`current_club_has_module`).
`requireModule` and the module checks in actions and in SQL use that
per-club answer. The `terms` helper (`lib/club-type.ts`) gives the wording
per type for the check-in screens only; older screens keep their wording.

**Gym check-in** (module `checkin`, gym clubs): staff create check-in points
under `/admin/checkin` and open `/admin/checkin/layar/<id>` full screen at the
entrance. The screen redraws a QR every 20 seconds pointing at
`/checkin?p=<point>&t=<token>`. Token scheme: `window = floor(epoch / 30)`,
`token` = first 12 hex characters of HMAC-SHA256(point secret, point id +
`:` + window); a scan accepts the current and the previous window, so a token
lives 30 to 60 seconds and a photo of the QR is useless afterwards. The
secret never leaves the database (column privileges hide it from clients;
only the admin-only `checkin_token()` returns a token).

A member scans with the phone camera. Not signed in: `/login` with a safe
internal `next` path, then back to the scan. If the point belongs to another
club of the same account the session is switched to it; if the account is not
a member there the result says "Anda bukan anggota klub ini". `record_checkin`
runs with the member's own JWT and rejects: invalid or old token or another
club's point (`CK005`), module off (`CK001`), inactive member (`CK002`), no
active plan (`CK003`), session pack used up (`CK004`). A second scan within
120 minutes returns the existing check-in (a per-member lock makes parallel
scans create one row). For clubs with the module, each check-in counts as one
session of a session pack (`subscription_usage` and `my_subscription_usage`
count check-ins instead of attended bookings). Staff can also record a manual
check-in (admin, or a coach for their own members) with the same rules.

Privacy: a check-in stores only member, point, time, plan and method
(`qr` or `manual`, plus who for manual). No IP and no device data. Scans are
limited to 10 per minute per profile. Clients cannot insert into `checkins`;
admin, receptionist and head coach read all of the club's check-ins, coaches
only their own members', members only their own.

## Modules per club, facilities and booking

A club's modules are its type's modules plus enabled overrides minus disabled
overrides, limited to `ready` ones (`tenant_module_overrides`,
`club_has_module`, `current_club_modules()`). The admin toggles them in
`/admin/settings/modul` (`set_club_module`); `members` can never be disabled.
Disabling hides navigation and returns 404 for the module's pages; data stays
and comes back when it is enabled again. Terms (`club_types.terms`, merged
with neutral defaults in `lib/club-type.ts`) hold the wording per type
(`resource`, `session`, `location`, ...), so a new sport is data only.

**Facilities and booking** (module `resource_booking`, swimming and gym
types): a facility (`resources`: court, lane, studio, room, floor) belongs to
a location and has capacity per slot, slot length, price per slot, booking
window (`advance_days`), cancel limit (`cancel_hours`) and opening hours per
weekday in WIB (`resource_hours`, 0 = Sunday). Bookings (`resource_bookings`)
are written only through security definer functions (`book_resource` for
admin and receptionist, `book_resource_as_member`, `cancel_booking`,
`set_booking_status`); clients have select-only policies, members see only
their own rows and `resource_availability` never returns names. Capacity is
enforced by a trigger that locks the facility row and checks the highest
number of overlapping bookings, so parallel requests cannot oversell a slot.
Staff and member bookings must sit on the slot grid inside opening hours and
not cross midnight. A class can use a facility (`classes.resource_id`): it is
mirrored as a booking row that takes one place and follows the class when it
moves or is deleted. Members book only with an active subscription (as in
check-in), only future slots within `advance_days`, and cancel until
`cancel_hours` before the start. The price is stored and shown; there is no
payment. Error codes: `RB001` slot full, `RB002` outside hours or off grid,
`RB003` module off, `RB004` time window, `RB005` too late to cancel, `RB006`
no active subscription, `RB007` conflicts with a class, `RB008` invalid or
not allowed.

Screens: `/admin/fasilitas` (admin), `/admin/booking` (admin, receptionist;
day and week calendar, click a slot), `/member/booking`. A new club lands on
`/admin/onboarding` (location, facilities, first package), every step can be
skipped, and a banner stays on the dashboard until it is finished
(`tenants.onboarding_completed_at`, `complete_onboarding()`).

## Platform billing (superadmin)

Swimma bills clubs separately from how a club bills its members. A
superadmin is not tied to any tenant and manages every club's plan and
status from `/superadmin`.

- Bootstrap the first superadmin from the CLI (there is deliberately no UI
  for this):
  ```bash
  SEED_SUPERADMIN_EMAIL=you@example.com SEED_SUPERADMIN_PASSWORD='a-long-password' \
  npm run seed:superadmin
  ```
- `/superadmin/login` uses its own `superadmin_session` cookie. The JWT
  carries `{ sub, superadmin: true, email, full_name }` with audience
  `swimma-superadmin`, is never sent to Supabase as a bearer token, and a
  tenant session JWT is rejected there. Every portal query uses the
  service-role client; the portal groups clubs by organization, edits plans,
  subscription status and the club-limit override, and can deactivate an
  owner. `superadmins`, `platform_tenant_usage`, `platform_organization_usage`,
  `org_owners` and every write to `organization_subscriptions` and
  `subscription_plans` are unreachable from `anon`/`authenticated`.
- Billing is per **organization**, not per club. `subscription_plans`
  (Standard, Advanced) holds the only copy of prices and limits;
  `organization_subscriptions` holds the organization's plan, period
  (monthly or yearly), status (`pending`, `trial`, `active`, `suspended`,
  `cancelled`), trial end, period dates and an optional club-limit override.
  `platform_modules` is a price-free registry (`ready` / `soon`) that club
  types will use later. `platform_plans`, `platform_subscriptions` and
  `organizations.max_tenants` are no longer read; they stay in the schema
  until a later cleanup migration.
- Status **suspended** or **cancelled** sets `tenants.is_active = false` on
  every club of the organization (`set_organization_status`): new logins are
  refused and live sessions lose access immediately. No data is deleted.
  Switching back to **active** or **trial** restores access.
- The superadmin sets **active** after payment outside the app, with period
  dates (monthly +1 month, yearly +1 year by default). A period end in the
  past is only flagged on `/superadmin`; nothing suspends automatically
  except the trial rule below.
- Owners read their subscription at `/admin/klub/langganan` and can change
  plan and period (no proration, no automatic billing); the superadmin edits
  plans, status, trial end and club-limit override.

### Pricing model

- Price = billable internal users × `price_per_user_month` × months.
  **Internal users** are the active owners plus active staff admins and
  coaches (`profiles.owner_id is null`) across the organization's clubs; an
  owner's per-club admin profiles count once; members and superadmins never
  count; minimum 1. Monthly = 1 month; yearly = 12 − `yearly_free_months`
  (11.5). The effective monthly price is the total ÷ 1 or ÷ 12.
- Seeded values: Standard Rp 150.000/user/month, up to 3 clubs, 30-day trial;
  Advanced Rp 250.000/user/month, unlimited clubs, no trial, starts
  `pending` until activated. Members and locations are unlimited on both;
  every `ready` module is included.
- `platform_quote(plan, period, users)` is the server-side calculation
  (execute revoked from clients). The landing page and wizard show a live
  estimate with the same formula over the plan rows; every authoritative
  figure (registration, plan change, the price-change confirmation shown
  before adding a coach, the superadmin portal) is recomputed on the server
  and nothing price-related is read from the client.
- Gates (`SW003`): while the subscription is `pending`, `suspended`,
  `cancelled` or an expired `trial`, adding members, clubs, coaches or staff
  admins is rejected; signing in and the billing page keep working. The
  organization's first club is exempt so registration can complete. `SW004`:
  a new club beyond `coalesce(club_limit_override, plan club limit)` is
  rejected (the subscription row is locked, so parallel creations cannot
  exceed it), and a plan or override change that leaves the organization
  over the limit is rejected, which blocks Advanced → Standard with more
  than 3 clubs.
- Infrastructure floor for reference: Vercel Pro ≈ $24/mo + Supabase Pro ≈
  $25/mo + usage buffer ≈ $20–30 → ≈ Rp 1.300.000/month at ≈ Rp 17.900/USD
  (verify before relying on it); marginal cost per extra organization ≈ 0
  until a higher tier is needed.

## Notes / out of scope

- Swim competition (lomba renang) tracking is intentionally not built, but
  nothing in the schema (e.g. `class_types`) assumes it can't be added
  later.
- WhatsApp and payment-gateway integrations are left as TODOs — invoices are
  marked paid manually by an admin for now.
- Admin creates coach accounts (temporary password, changed on first
  login). Members sign in read-only after an admin or their coach activates
  the account; there is no self-registration and no parent role.
- Not built: payment gateway, invoices or receipts for Swimma itself,
  proration, automatic renewal or suspension at period end, coupons,
  per-module pricing, a coach in several clubs, moving a club between
  organizations, self-registration, member self-booking of classes,
  invitations or password reset by email, one person as both coach and
  member, check-out, geofence, staff scanning the member's QR, door
  hardware, CSV export of check-ins, push notifications.

## Changelog

### 2026-10-05

- Per-club module toggles (`/admin/settings/modul`), terms stored per club type, and a skippable onboarding wizard with a dashboard banner.
- Generic facilities and booking engine: `resources`, `resource_hours`, `resource_bookings`, capacity by locked max-overlap, class sync, RPCs and error codes `RB001` to `RB008` (migrations `20250101000020_modules_onboarding.sql` and `20250101000021_resource_booking.sql`).
- Admin `/admin/fasilitas` and `/admin/booking` (day and week calendar), member `/member/booking`, optional facility on classes.

### 2026-10-04

- Gym check-in: rotating QR (30-second windows, 60 seconds of validity), `/checkin` scan route, `record_checkin` with codes `CK001` to `CK005`, 120-minute duplicate rule, manual check-in, session packs counted from check-ins.
- Admin `/admin/checkin` (today, points, full-screen QR, hour histogram, members with no visit in 14 days); member `/member/kunjungan` and a result screen.
- Minimal club types (`swimming`, `gym`) with per-club modules (migrations `20250101000018_club_types.sql` and `20250101000019_gym_checkin.sql`).

### 2026-10-03

- Members can sign in on `/login` (read-only `/member`: subscription and remaining sessions, invoices, upcoming classes, promo); one account can belong to many clubs, with `/member/klub` and `switchClub`.
- Admins and coaches activate accounts from the member ("Aktifkan akun") and reset temporary passwords; gated by the `member_portal` module (now `ready`).
- One email is one kind of identity across owners, coaches/staff and members (migration `20250101000017_member_login.sql`).

### 2026-10-02

- Billing moved from club to organization: Standard and Advanced plans priced per internal user (monthly or yearly), `organization_subscriptions`, `platform_quote`.
- Member and location limits removed (`SW001`/`SW002`); `SW003` now gates pending, suspended and expired-trial organizations; `SW004` uses the plan club limit.
- New landing pricing, `/daftar` wizard, `/admin/klub/langganan`, price-change confirmation when adding a coach, superadmin plan and subscription editors (migration `...014_org_billing.sql`).

### 2026-10-01

- Organizations own many clubs (`max_tenants`, `SW004`); one `/login` for owner, admin and coach; owner club list and switcher.
- Parent and child accounts removed: `members` with `coach_id` and contact fields; coaches see only their own members.
- Migrations `20250101000012_organizations.sql` and `20250101000013_members.sql`; superadmin portal grouped by organization.

### 2026-09-26

- Platform billing: `superadmins`, `platform_plans`, `platform_subscriptions`,
  `platform_tenant_usage` (migration `20250101000010_platform_billing.sql`),
  `/superadmin` portal, `npm run seed:superadmin`.
- Plan member and location limits enforced in the database.
- Suspended/cancelled clubs lose access immediately, including live
  sessions; `tenants` is now column-restricted for club admins.
- Self-service club signup at `/daftar` with a 14-day trial.
- Landing page pricing section and admin trial banner, both reading
  `platform_plans`.
- Deactivated/suspended sessions are cleared through
  `/api/auth/session-ended` (cookies can't be deleted during Server
  Component render).

### 2026-09-22

- Added `frontend-design`, `bencium-innovative-ux-designer`, `design-audit`
  skills under `.claude/skills/`.
- Admin dashboard (`/admin`) now shows live KPIs, overdue/expiring alerts,
  today's classes, recent cash entries, and quick actions (was a static
  welcome card).
- Search/filter added to the members, coaches, schedule, subscriptions, and
  invoices list pages.
- New session-pack billing mode (N sessions / X weeks) alongside the
  existing recurring `billing_cycle` packages — additive migration
  `20250101000009_session_packages.sql`, a `subscription_usage` view, and a
  fix to `generate_invoices_for_period` so it never double-bills
  session-pack subscribers.
- Light/dark theme (`next-themes`).
- Add/manage flows switched from dedicated pages and always-visible inline
  forms to dialogs (native `<dialog>`, Next.js intercepting routes for
  members/coaches/schedule).
- Public marketing landing page at `/` (hero, features, how-it-works,
  multi-tenant section, dashboard preview, CTA, footer); an authenticated
  session still redirects straight to its role home, and `/login` is
  unchanged.
