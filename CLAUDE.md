@AGENTS.md

Always use the lean-dev skill.

## Catatan tim (per 2026-10-01)

Status
- Production Vercel: READY. Supabase project `swimma` masih kosong; migrasi 001-013 belum diterapkan dan env Supabase di Vercel belum mengarah ke project itu. `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual dari dashboard (project butuh legacy HS256 JWT secret).
- Setelah migrasi: `npm run seed:superadmin` untuk akun superadmin pertama. Jangan terapkan migrasi 012-013 sebelum kode versi ini dideploy (pemilik dipindah ke `org_owners`, parent dihapus). Vercel Authentication masih aktif, situs belum publik. GitHub Pages (`mvp/`) gagal sampai Pages diaktifkan.
- Fitur per paket masih kajian (`KAJIAN_PAKET.md`), belum dibangun; yang dibatasi baru jumlah anggota dan lokasi.

Sisa risiko keamanan
- Penguncian akun setelah 5 gagal login bisa dipicu orang lain yang tahu email (kunci 15 menit). Rate limit per IP (`hit_rate_limit`) membatasi skalanya.
- CSP baru membatasi framing/form/base-uri; belum membatasi script (butuh nonce).
- Belum ada FAQ, Kebijakan Privasi, dan Syarat & Ketentuan (wajib sebelum publik karena menyimpan data anak).
- Penagihan masih per klub; belum ada paket atau tagihan tingkat organisasi.

Terbuka
- Trial yang habis hanya memblokir penambahan anggota/lokasi baru (`SW003`); akses lain tetap jalan sampai superadmin men-suspend.
- Angka di landing page ("1.240+", "27 klub", nama klub contoh) masih fiktif; ganti sebelum dipublikasikan.

Aturan teknis
- Semua waktu memakai WIB lewat helper di `lib/format.ts` (`formatJakarta*`, `parseJakartaLocalInput`); jangan pakai `toLocale*String` atau `new Date(datetimeLocal)` langsung.
- Hierarki: organisasi (akun pemilik) -> klub -> pelatih -> anggota. Anggota tidak punya login; tidak ada peran orang tua.
- Satu `/login` (email + kata sandi). Pemilik ada di `org_owners`; tiap klub punya satu profil `admin` pemilik (`profiles.owner_id`). Pindah klub memakai `switchTenant` (JWT dibuat ulang, tanpa kata sandi). Peran RLS tetap `admin` dan `coach`.
- Email unik lintas pemilik dan pelatih (database); pelatih hanya di satu klub. Klub baru dibuat hanya lewat fungsi SQL `register_organization` / `create_tenant_for_owner` (service_role), sehingga selalu punya baris trial.
- Batas paket ditegakkan trigger database (`SW001` anggota, `SW002` lokasi, `SW003` trial habis, `SW004` jumlah klub per organisasi, `organizations.max_tenants`, default 3, hanya superadmin yang mengubah). Klub lama tanpa baris `platform_subscriptions` tidak dibatasi.
- Suspended/cancelled mematikan akses lewat `tenants.is_active`; data tidak pernah dihapus.
- Ganti/atur ulang kata sandi mencabut semua sesi lama lewat `profiles.sessions_valid_after`.
- Aksi server yang dipakai sebagai form harus mengembalikan `ActionState` dan dibungkus `ActionForm`, supaya error tampil ke pengguna.
- Fungsi `security definer` baru wajib di-`revoke execute ... from public, anon, authenticated` kecuali memang untuk klien.
