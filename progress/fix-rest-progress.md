# fix-rest progress

## Status

- [x] Phase 0: preparation (OK received)
- [x] Phase 1: sessions, access, superadmin (migration 025; hosted pending)
- [x] Phase 2: money and billing (migration 026; hosted pending)
- [ ] Phase 3: performance and pagination
- [ ] Phase 4: public auth
- [ ] Phase 5: uploads, audit log, privacy
- [ ] Phase 6: UI, validation, finish

Hosted: pending for every phase that adds migrations (no `SUPABASE_ACCESS_TOKEN` or `DATABASE_URL` in the environment; hosted is at migration 011). Started with the user's go-ahead although the hosted part of `fix-hosted` is still open.

## Inventory

### Session validation (one shared check)

- Guards: `requireRole`, `requireActionRole`, `requireOwnerAction` (via `requireActionRole`), `requireMemberClub`.
- Server actions using `requireActionRole` (all files in `lib/actions/` except `auth.ts`, `superadmin.ts`): accounts, attendance, billing, booking, cash-ledger, checkin, coaches, member-accounts, member (`switchClub`), members, modules, onboarding, orders, owner (`createTenant`, `switchTenant`), payroll, products, promo, resources, schedule, settings, staff, subscription.
- Token-only today: `lib/actions/auth.ts` (`changePassword`), `app/change-password/page.tsx`, `app/checkin/route.ts` (before `requireRole`), `app/api/auth/logout`, `app/api/auth/session-ended`.
- Pages reading `getSession()` under a guarded layout: admin staff, invoices, schedule list/detail/modal, member detail/modal, coach home and attendance, landing `/`, subscription banner.
- Superadmin: `lib/auth/superadmin.ts`, `app/api/superadmin/login`, `app/api/superadmin/logout`, `lib/actions/superadmin.ts`.

### Writes to money tables

- `invoices`: client update in `voidInvoice` (`lib/actions/billing.ts`); `mark_invoice_paid`; `generate_invoices_for_period` (cron route and billing action); session-pack trigger on `subscriptions`.
- `payroll_runs`: `create_payroll_run` only (app); table policy currently allows all commands.
- `cash_ledger`: client insert of manual entries (`lib/actions/cash-ledger.ts`); `mark_invoice_paid`, `create_payroll_run`, `create_order`/`add_order_payment`, `void_order`.
- `subscriptions`: client insert/update in billing actions (policy allows all commands).

### Tables touched by member anonymisation

`members` (name, birth date, contact, address, notes, link to profile), the club's member `profiles` row (name, email, phone), `member_accounts` (only when no other club profile remains), `bookings.notes`, `orders.customer_name`, `resource_bookings` (guest fields), consent records. Kept: invoices, subscriptions, check-ins, bookings, orders, payments, ledger.

## Plan

1. Sessions: one `validateSession()` used by every guard, the change-password page and action, the check-in route and the logout/session-ended routes; current password required unless forced; password policy and short common list; logout moves `sessions_valid_after`; staff admin limits; policy additions. Superadmin TOTP, recovery codes, own secret, session table (12 h), IP+account lockout, reset script.
2. Money: RPC-only writes for invoices and payroll with immutability triggers; ledger triggers for author and date; same-club reference checks; `void_order` reason, same-day rule for receptionists, new reversal category linked to the order; invoice generation filters; member deactivation pauses subscriptions; expired-trial and pending write gate (`SW003`) with banner.
3. Performance: `(select fn())` policies, merged duplicates, indexes, rewritten check-in views; pagination (50, exact count) on members, subscriptions, invoices, schedule, cashier; EXPLAIN before/after kept in `audit/`.
4. Public auth: uniform responses with dummy hash, Origin/Fetch-Metadata check, body and password caps, trusted client IP, fail-closed limiter; pending-verification signup with Resend link and Turnstile (skipped with a startup warning when unset); nonce CSP.
5. Uploads, audit log, privacy: bucket limits and server checks, object removal and orphan script, class delete rule, https logo; `audit_log` with admin and owner views; consent records, `anonymise_member`, JSON export, `docs/RESTORE.md`.
6. UI and validation: layout, labels, focusable tables, contrast, landmarks, targets; zod and CHECK limits (existing rows checked first); booking rules with the late-attendance confirmation; member form hint; final checks and docs.

## Phase 1 done

- Shared session check used by page guards, action guards, the change-password page and action, logout and session-ended; current password required unless a change is forced; password policy updated; logout ends the account's sessions on all devices; session-ended keeps a valid session.
- Password resets by staff admins limited to coaches, receptionists and finance; owners can also reset staff admins; owner-linked profiles protected from staff admin updates; club-wide reference tables require an active session.
- Platform admin: authenticator enrolment at first login, recovery codes, separate signing secret, revocable 12-hour sessions, failure limit per IP and account, reset script.
- Local probes in `audit/` rerun for these items with the intended results; migration 025 applies on empty databases with both pgcrypto layouts and on the seeded data. Hosted pending.

## Phase 2 done

- Invoices and payroll change only through functions; settled, voided and posted rows are immutable; manual ledger entries take their author and time from the session; profile and ledger references checked against the club.
- Order cancellation needs a reason and records a reversal linked to the order; receptionists cancel only orders paid the same day (WIB) or unpaid open orders.
- Invoice generation skips inactive members and clubs, organizations outside an active or running trial status and subscriptions outside their dates; deactivating a member pauses their subscriptions.
- Expired trial and pending organizations: reads and settling existing invoices keep working; new bookings, orders, check-ins, classes, payroll runs and invoice generation are refused with `SW003`; banner text updated.
- Local checks in `audit/fix/` and a UI run passed; demo seed and purge run on a fresh database through 026. Hosted pending.
