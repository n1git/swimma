@AGENTS.md

Always use the lean-dev skill.

## Catatan tim (per 2026-10-01)

Status
- Production Vercel: READY. Supabase project `swimma` masih kosong; migrasi 001-010 belum diterapkan dan env Supabase di Vercel belum mengarah ke project itu. `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual dari dashboard (project butuh legacy HS256 JWT secret).
- Setelah migrasi: `npm run seed:superadmin` untuk akun superadmin pertama. Vercel Authentication masih aktif, situs belum publik. GitHub Pages (`mvp/`) gagal sampai Pages diaktifkan.
- Fitur per paket masih kajian (`KAJIAN_PAKET.md`), belum dibangun; yang dibatasi baru jumlah anggota dan lokasi.

Temuan keamanan yang belum diperbaiki
- Tinggi: `generate_invoices_for_period` (security definer) belum di-`revoke` dari public/anon/authenticated, sehingga bisa dipanggil lewat REST dan membuat tagihan lintas klub. Perbaiki sebelum migrasi pertama.
- Tinggi: `next@16.3.5` kena advisory RCE `next/og` (tidak dipakai di kode); upgrade ke 16.3.8.
- Sedang: tidak ada rate limit di `/api/auth/login` dan `/daftar`; tidak ada security header di `next.config.ts`.
- Rendah: `.or()` di `searchParentByContact` memakai input mentah; sesi 7 hari tidak bisa dicabut; `generateTempPassword` memakai `Math.random`.

Bug fungsional terbuka
- Password sementara pelatih/orang tua dibuat lalu dibuang (`createCoach`, `createChild`), jadi akun buatan admin tidak bisa login. Perlu keputusan: tampilkan sekali ke admin atau alur atur-kata-sandi.
- Tombol nonaktifkan pelatih, batalkan tagihan, dan hapus kelas/booking/promo masih mengabaikan error.
- Trial yang habis tidak otomatis dibatasi; superadmin harus men-suspend manual.

Aturan teknis
- Semua waktu memakai WIB lewat helper di `lib/format.ts` (`formatJakarta*`, `parseJakartaLocalInput`); jangan pakai `toLocale*String` atau `new Date(datetimeLocal)` langsung.
- Batas paket ditegakkan trigger database (`SW001` anggota, `SW002` lokasi). Klub tanpa baris `platform_subscriptions` tidak dibatasi.
- Suspended/cancelled mematikan akses lewat `tenants.is_active`; data tidak pernah dihapus.
- Angka di landing page ("1.240+", "27 klub", nama klub contoh) masih fiktif; ganti sebelum dipublikasikan.
