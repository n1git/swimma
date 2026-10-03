# ui-nuvio progress

Restyle of the signed-in app to the framed, hatched card structure. Colors and fonts unchanged; UI only.

## Status

- [x] Phase 0: preparation
- [x] Phase 1: tokens and primitives
- [ ] Phase 2: shell
- [ ] Phase 3: pages
- [ ] Phase 4: sweep and final checks

## Phase 0 result

- Pages by layout pattern:
  - Dashboard: `/admin`, `/coach`, `/member`, `/superadmin` (portal home), `/admin/reports`, `/admin/checkin`, `/admin/klub`, `/admin/klub/langganan`.
  - List (header, filters, table or card grid): members, coaches, staff, schedule, booking, fasilitas, kasir (terminal), pesanan, produk, billing packages, subscriptions, invoices, cash ledger, payroll, promo, audit, `/coach/schedule`, `/coach/members`, `/member/pesanan`, `/member/kunjungan`.
  - Detail: members `[id]`, coaches `[id]`, pesanan `[id]`, coach attendance, klub pages.
  - Form: members `new`, coaches `new`, schedule `new`, settings, settings/modul, onboarding, member booking.
- Approach: `Card` itself becomes the framed card (hatch frame, header row on the hatch, inner body), so every page built from `Card`, `CardHeader`, `CardContent` inherits it. `frame={false}` keeps the old flat card for the landing preview and the auth pages. Control sizes (button, input, select, textarea, label, badge) change only inside `.app-ui`, the class set on the app shell root, so the landing and auth pages keep their sizes. Breadcrumbs derive from the grouped navigation (group label, then item label) through a context provider; no new copy.
- Dashboards: no queries are added, so the layout uses the data the pages already load; sparklines and deltas are supported by `MetricCard` but only rendered where a series already exists.

## Phase 1 done

- Tokens added only: `--frame`, `--stripe` (color-mix of existing tokens, so light and dark follow the existing values), `--radius-inner`, `--radius-frame`, easing and four durations that become 0 ms under reduced motion; `.hatch` and `.ui-transition` utilities. No existing token or font setup changed.
- `Card` (framed), `Table` (tabular numbers, lighter header), `Dialog` and `TriggerDialog` (framed), `Button`, `Input`, `Select`, `Textarea`, `Label`, `Badge` restyled; app controls are 44 px high with 16 px text on phones and 32 px with 12 px text from `sm` up.
- New: `FramedCard`, `MetricCard` (replaces `StatCard`, optional delta with text and optional sparkline), `PageHeader` with `Breadcrumb`, `NavGroupsProvider`.

## Phase 2 done

- Shell: the sidebar now runs full height with a 54 px brand row (small logo tile, brand name, dashed bottom border), captions, 34 px rows and a soft border and shadow on the active row (sidebar colors unchanged); the header sits beside it with the same 54 px height and a dashed bottom border, and keeps the club name, role chip, tenant and club switchers, theme toggle, password and sign-out controls in the same order. Bottom bar gets a dashed top border and transitions on the shared motion tokens; the menu sheet's group containers use the frame radius. Switchers inherit the new control sizes through `Select`.
