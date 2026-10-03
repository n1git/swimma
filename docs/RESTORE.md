# Backup and restore

Status: **not yet rehearsed.** Run the drill below once before real member data is stored, then record the date and result at the bottom of this file.

## What holds data

| Store | Content | Backed up by |
|---|---|---|
| Supabase Postgres (project `swimma`) | All application data, audit log, consent records | Supabase daily backups (plan dependent); point-in-time recovery if enabled on the plan |
| Supabase Storage, bucket `promo` | Promo images | Not included in database backups; copy separately (see below) |
| Vercel | Application code only | Git history of this repository |

Secrets (`SUPABASE_*`, `SUPERADMIN_JWT_SECRET`, `CRON_SECRET`, email and captcha keys) live in the Vercel project settings and a password manager, never in backups or the repository.

## Regular backup

1. Confirm in Supabase (Project Settings, Database, Backups) that daily backups are enabled and note the retention period.
2. Weekly logical dump kept outside Supabase, with the connection string from Project Settings, Database:
   ```sh
   pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file swimma-$(date +%F).dump
   ```
   Store the file encrypted (it contains personal data of members, including children). Keep at most the retention period stated in the privacy policy.
3. Promo images: download the bucket with the Supabase CLI (`supabase storage cp -r ss:///promo ./promo-backup --experimental`) or skip if promos are not business critical.

## Restore drill (staging project)

1. Create a temporary Supabase project in the same region and Postgres major version.
2. Move `pgcrypto` into `extensions` if needed and apply nothing else.
3. Restore the latest dump:
   ```sh
   pg_restore --dbname "$STAGING_DATABASE_URL" --no-owner --no-privileges --clean --if-exists swimma-YYYY-MM-DD.dump
   ```
4. Check: row counts of `organizations`, `tenants`, `members`, `invoices`, `cash_ledger`, `audit_log` match the source at dump time; `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity` returns 0; the migration list matches the repository.
5. Point a preview deployment at the staging project and run the smoke test in `docs/DEPLOY.md` with a demo account.
6. Delete the staging project and every local copy of the dump.

## Real restore

1. Put the site in maintenance (Vercel: promote a maintenance deployment or enable Vercel Authentication).
2. Restore from the Supabase dashboard (daily backup or point in time) or with `pg_restore` as above into the production project.
3. Run step 4 of the drill against production, then the smoke test.
4. Rotate `SUPABASE_JWT_SECRET` and `SUPERADMIN_JWT_SECRET` only if the incident involved credential exposure; that signs everyone out.
5. Record what was restored, from which point in time, and why.

## Drill log

| Date | Backup used | Result | By |
|---|---|---|---|
| | | not yet rehearsed | |
