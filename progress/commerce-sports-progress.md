# commerce-sports progress

Products, orders, point of sale, manual payments, then sport club types (tennis, padel, pilates, yoga) on the shared core.

## Status

- [x] Phase 0: preparation and plan. OK given in the same message as the task ("ok, you decide"): defaults accepted.
- [ ] Phase 1: commerce, database and server (`022_commerce.sql`)
- [ ] Phase 2: products and POS UI
- [ ] Phase 3: sport club types and dashboard (`023_sport_club_types.sql`)
- [ ] Phase 4: cleanup and final checks

## Repository assessment

- Dependency: `resource-booking` is finished (all phases in its progress file, last commit `5f17105`). `main` is in step with `origin/main`.
- Latest migration is `20250101000021`; new ones are `022` (commerce) and `023` (club types).
- Money today: `invoices` paid by `mark_invoice_paid` write one `cash_ledger` row (`payment_received`, needs `invoice_id`). `cash_ledger` is append-only, tenant-scoped, readable by admin and finance, with a `cash_ledger_traceable` check that ties each category to its source column, and a trigger that checks the source belongs to the tenant. Clients can currently insert any ledger category that passes the check (admin and finance).
- Modules: `platform_modules` + `club_type_modules` + per-club overrides; effective modules via `club_has_module`. Admin nav and `requireModule` layouts are the pattern for gating.
- Terms: `club_types.terms jsonb` already exists since migration 020 and `getClubTerms` already reads it with defaults. There is no `termsFor`.
- Club types today: `swimming` and `gym` are `ready`. Registration and "Tambah klub" already list `ready` types from the table.
- Facilities and bookings exist (`resources`, `resource_bookings` with price per booking, written only by RPCs).
- Visual state: Table/Card/Badge/Dialog components, no cart or receipt component yet.

## Mismatches and assumptions

1. **Decision 9 is already done** (terms in the database since 020). Phase 3 only adds terms for the new types and keeps the neutral defaults; no `termsFor` is created because `getClubTerms` is the existing equivalent.
2. **"Common set".** In migration 018 the common set includes `classes`. The prompt adds `classes` explicitly for pilates and yoga, which implies the common set has none. Assumption: common = `members, plans, billing, cash_ledger, payroll, promo, member_portal`. Tennis and padel therefore have no `classes` module (their coaches still exist; lessons are bookings of a court). Pilates and yoga get `classes`. `swimming` and `gym` keep what they have and gain `pos` only.
3. **Ledger.** New category `order_payment` with nullable `order_id`; `cash_ledger_traceable` is replaced by a version that keeps the three old branches and adds the new one, so every old row stays valid. Added column `cash_ledger.order_id` is not visible through `cash_ledger_with_balance` (a `select *` view frozen at creation); the view is not changed because nothing needs `order_id` there.
4. **Ledger forgery risk.** Today an admin or finance client can insert any valid ledger row directly. With a new category, a client could insert an `order_payment` row for a real order without a payment. The client insert policy is narrowed to `manual_adjustment` only (existing UI only inserts that category; `payment_received` and `payroll` rows are written by security definer functions).
5. **Reports.** `report_revenue`, `report_revenue_by_program` and the dashboard "pendapatan" count paid invoices only, so POS sales do not appear there. Cash flow and the cash ledger do include them. Not changed (out of scope); POS sales appear in the new "Penjualan hari ini" KPI and on the orders page. Needs your call if you want them in the revenue report.
6. **Roles.** Admin and receptionist sell and void; finance reads orders, order items, payments and products; coach nothing. Product management (create/edit) admin only; receptionist reads products. Voiding is admin and receptionist as decided (any void restores stock).
7. **Booking lines.** A booking can be added as a line only if it is `confirmed`, belongs to the tenant, is not a class row, and is not already on another non-void order. Its member and the order's member must match when both are set. Price comes from `resource_bookings.price`. Paying (fully) sets `paid_at`; voiding an order clears `paid_at` again only if no other paid order holds it (a booking is on at most one non-void order, so clearing is safe). The booking is not cancelled by a void.
8. **Payments.** An order is `open` until payments sum to the total; each `add_order_payment` writes one `order_payments` row and one ledger entry; the order becomes `paid` when the sum reaches the total (overpayment is rejected; no change calculation beyond the UI hint). Stock decrements when the order becomes `paid`, in that transaction, locking product rows ordered by id. `create_order` therefore creates an `open` order without touching stock; selling in one step is `create_order` + `add_order_payment` called from the POS action. Voiding a `paid` order restores stock once and reverses the ledger with an `out` entry (`order_payment` cannot be `out` in the check as specified, see 9). Voiding an `open` order with partial payments is refused (pay or void must be clean).
9. **Reversal of payments on void.** The prompt says each payment creates a ledger `in` entry but not what a void does to money. Assumption: voiding a paid order is allowed, restores stock, and adds one `manual_adjustment` `out` ledger entry per payment with the reason "Pembatalan pesanan <nomor>" so the cash balance stays true and the ledger stays append-only. Void on `open` orders is only allowed when no payment exists. This needs your OK in the final line.
10. **Order number.** `<prefix><year>-<000001>` like `POS-2026-000001` per tenant per year from `order_counters` using `insert ... on conflict do update ... returning`, safe under concurrency. Unique `(tenant_id, number)`.
11. **Member view.** `/member` gets a read-only "Pesanan saya" page (paid orders, own `member_id` only) when `member_portal` is on and `pos` is enabled; members have select policies only on their own paid orders and items.
12. **Product stock and `track_stock = false`.** Untracked products never change stock. Editing stock by hand is allowed for admin (`stock_qty >= 0`).
13. **Money and rounding.** `numeric(14,2)`; line totals computed in SQL (`qty * unit_price`), never trusted from the client. Unit price for products comes from `products.price` at order time and is stored on the line (later price changes do not alter old orders).
14. **Club types.** New `ready` types: tennis, padel, pilates, yoga. `soon`: crossfit, martial_arts, dance, badminton, futsal, basketball, other. `other` as a registration choice stays hidden because it is `soon`. Terms: coach is "Pelatih" for tennis/padel, "Instruktur" for pilates/yoga; resource: Lapangan / Studio. Presets: tennis `court` "Lapangan Tennis {n}" x2, padel `court` "Lapangan Padel {n}" x2, pilates `studio` "Studio {n}" x1, yoga `studio` "Studio {n}" x1; slot 60 minutes, and capacity per kind in the onboarding form defaults (court 1, studio 12) are applied in code per `kind`, not per sport.
15. **Presets capacity.** `club_type_presets` has no capacity column. To keep "a sport is data" I add `default_capacity` (default 1) in migration 023 and use it in the onboarding form, which also fixes the lane-capacity point I raised last task (swimming lane 4, gym floor 20).
16. **Risks.** Money correctness (ledger, stock, void), concurrency (stock, order numbers), and regressions in the existing cash ledger page (needs the new category label). Mitigation: SQL tests for parallel orders and void, old ledger rows kept, label added.

## Plan

**022_commerce.sql**: `products`, `orders`, `order_items`, `order_payments`, `order_counters`, `next_order_number`, `resource_bookings.paid_at`, ledger category/`order_id`/check/trigger/policy change, RPCs `create_order`, `add_order_payment`, `void_order`, module `pos` (ready at end), `club_type_modules` for swimming/gym, RLS by role, execute revoked on internal functions.

**Phase 1 code**: validations, actions for products and orders (RPC-backed), readers.

**Phase 2 UI**: `/admin/produk`, `/admin/kasir`, `/admin/pesanan`, `/member/pesanan`, nav, receipt print view.

**023_sport_club_types.sql**: new club types, module mappings, terms, presets (+ `default_capacity`), `pos` mapping for the new types. Dashboard KPI cards.

**Phase 4**: README, CLAUDE.md, final checks, futsal-as-data proof.

## Decisions I need from you (defaults applied)

Assumptions 2, 5, 8, 9 (void reverses cash with manual adjustments) and 15.
