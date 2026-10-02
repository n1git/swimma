# landing-rework progress

Public landing page (`/`) for Swimma as one app for all sports clubs; every claim true and traceable.

## Status

- [x] Phase 0: preparation
- [ ] Phase 1: foundations
- [ ] Phase 2: content sections
- [ ] Phase 3: pricing, FAQ and finish
- [ ] Phase 4: final checks

## Repository assessment

- `app/page.tsx` is one 349-line server component: redirect for a signed-in session, live `getActivePlans`/`getModules`, `LandingPricing`, and fake content (hero figures "1.240+", "310", "27"; demo clubs "Kolam Renang Melati", "Aquatic Center Nusantara", "Sekolah Renang Ombak"; demo dashboard figures and names). Copy is swimming-only.
- `UsersInput` hint says internal users are "Pemilik, admin, dan pelatih"; the database counts owner, admin, coach, receptionist and finance (`organization_internal_users`, migration 016). This is a false statement shown on the landing and `/daftar`; fixed in Phase 3.
- Root metadata description says "Manajemen klub renang anak"; no sitemap, robots, Open Graph image or JSON-LD exist; `/privasi` and `/syarat` do not exist.
- `club_types` is readable by `anon` (migration 018), so the sports section can be data-driven. `subscription_plans` and `platform_modules` are already read for pricing.
- Another session (`audit-seed`) works on `main` in parallel; this task touches only landing files, `app/layout.tsx` metadata, new public routes, `.env.example`, README, CLAUDE.md and the pricing hint.
- `CLAUDE.md` still says the member portal and check-in modules are not built; both are `ready` (migrations 017, 019). Corrected in Phase 4 together with the fake-figures and legal-pages notes.

## Design decisions

- Skill run: `search.py "sports club management SaaS landing page" --design-system` returned "Vibrant & Block-based", red palette and Bebas Neue, aimed at fan/team sites, which does not fit a B2B tool. Per the skill's query contract I retried once with a B2B framing ("B2B SaaS management software for clubs, trust, feature showcase, pricing"); that result is the authority used here.
- Pattern: "Hero + Features + CTA" with CTA in the hero, the sticky header and at the bottom (deep CTA placement). Sections keep the user's order (header, hero with preview, sports, features by job, how it works, multi-club, pricing, FAQ, final CTA, footer).
- Color strategy: trust blue with a contrasting CTA. The existing brand tokens already are a trust blue (`--primary` #0369a1 light, #38bdf8 dark); kept unchanged. Contrast check of the tokens used for text: primary on white 5.9:1, primary-foreground on primary 5.9:1 (light) and #082032 on #38bdf8 9.3:1 (dark), muted-foreground on background 4.9:1 (light) and 6.8:1 (dark). No failure, so no token change.
- Style: the skill proposed Glassmorphism. Applied only where it does not cost contrast or speed: the sticky header uses `backdrop-blur` over a translucent background; cards stay solid (`bg-card`) because frosted cards over busy backgrounds risk contrast and add paint cost on mobile.
- Typography: the skill proposed Plus Jakarta Sans (mood: friendly, modern, SaaS, B2B). Kept the app's Lexend (headings) and Source Sans 3 (body), which match that mood and are already loaded by the app; adding a third family would cost page weight and split the brand between landing and app. Base 16 px body, 1.5 line height, headings 36-60 px with tight tracking.
- Effects: subtle, 150-300 ms hover transitions; the existing `fade-up` only under `motion-safe`. No animation library.
- Avoid (from the skill): excessive animation, dark mode by default (light stays the default; dark via the existing toggle).
- Pre-delivery checklist result: to be filled in Phase 4.

## Page outline and components (`components/landing/`)

1. `landing-header.tsx`: skip link target, brand, section links, theme toggle, Masuk, Daftarkan klub; mobile menu (client, native `<details>`-free button + panel, Escape closes).
2. Hero (`hero.tsx`) with `hero-preview.tsx` built from `Card`, `Badge`, `Table` and the booking/POS look, labelled "Contoh data".
3. `sports-section.tsx`: reads `club_types` (ready cards, soon "Segera hadir").
4. `features-section.tsx`: features by job (Anggota & paket, Jadwal & kehadiran, Fasilitas & booking, Check-in QR, Kasir & produk, Buku kas & gaji pelatih, Portal anggota, Peran & akses, Laporan & dasbor, Modul per klub; WIB and data isolation as trust notes).
5. `how-it-works.tsx`: four steps.
6. `multi-club.tsx`: organization, clubs, switcher, sample cards labelled "Contoh data".
7. `pricing-section.tsx`: copy from live plans around `LandingPricing`.
8. `faq.tsx`: native `<details>`.
9. `final-cta.tsx`, `landing-footer.tsx` (links to `/privasi`, `/syarat`, contact when set).
10. `json-ld.tsx`; `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `app/privasi/page.tsx`, `app/syarat/page.tsx`, `lib/contact.ts`.

## Claims table

| Claim on the page | Proof |
|---|---|
| (filled in Phase 2 and 3) | |

## Phase 1 done

- `ui-ux-pro-max` run again (skip link guidance: provide a skip-to-content link; mobile-first breakpoints). Header: sticky, translucent with backdrop blur (the one glass element), skip link "Langsung ke konten" to `#konten`, section links from `md`, theme toggle, Masuk and Daftarkan klub; below `md` a menu button (`aria-expanded`, `aria-controls`, 44 px) opens a panel with 48 px rows that closes on Escape (focus back to the button) and on link click. Footer: product links, account and legal links, contact only when an env var is set, WIB note.
- `Section` wrapper (id, `aria-labelledby`, eyebrow, balanced H2, intro, 64/96 px vertical rhythm, `max-w-6xl`, 16/24 px gutters, `scroll-mt-20` for the sticky header). Type scale: body 16-18 px, H2 30-36 px, H1 set in Phase 2.
- `lib/site.ts`: `SITE_URL` (`NEXT_PUBLIC_SITE_URL`, then the Vercel production URL, then localhost) and `getContact()` (`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`), both documented in `.env.example`.
- Root metadata: `metadataBase`, title template, new description (all sports, not swimming only), Open Graph and Twitter tags; `app/opengraph-image.tsx` (1200x630, brand colors, no claims beyond the H1); `app/robots.ts` (app areas disallowed, sitemap link); `app/sitemap.ts` (`/`, `/daftar`, `/login`; legal drafts left out because they are `noindex`).
- `/privasi` and `/syarat` drafts with `noindex`, a visible "Draf" notice and no compliance claim.

### What the legal drafts assume

- `/privasi`: the stored data list matches the schema (org owners, staff profiles incl. optional phone, members incl. date of birth, address, notes, contact name and phone, member accounts, classes, bookings, attendance notes, subscriptions, invoices, orders, manual payments, cash ledger, payroll, check-ins without IP or device data, guest name and phone on bookings, customer name on orders, promo images in Supabase Storage, IP addresses kept briefly as rate-limit keys in `auth_rate_limits`); cookies: `app_session` (httpOnly, 7 days) and the theme in browser storage; services: Supabase (database, storage) and Vercel (hosting); no analytics or tracking; fonts are self-hosted by `next/font` (no request to Google at runtime); data is not deleted when access ends. It assumes the operator is the data processor and the club the controller, and does not name a legal entity, retention period or jurisdiction; these need your review.
- `/syarat`: describes the account model, roles, one email per identity, pricing per internal user, manual activation after payment, the effect of pending/expired/suspended/cancelled subscriptions (`SW003`, `tenants.is_active`), and that member payments are recorded manually. It does not set liability limits, governing law, refund rules or an operator name.
