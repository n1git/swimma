@AGENTS.md

Always use the lean-dev skill.

## Catatan tim (per 2026-10-01)

Status
- Production Vercel: READY. Supabase project `swimma` masih kosong; migrasi 001-016 belum diterapkan dan env Supabase di Vercel belum mengarah ke project itu. `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual dari dashboard (project butuh legacy HS256 JWT secret).
- Setelah migrasi: `npm run seed:superadmin` untuk akun superadmin pertama. Jangan terapkan migrasi 012-016 sebelum kode versi ini dideploy (pemilik dipindah ke `org_owners`, parent dihapus, langganan pindah ke organisasi). Halaman harga di landing kosong sampai 014 diterapkan (harga hanya ada di tabel). Vercel Authentication masih aktif, situs belum publik. GitHub Pages (`mvp/`) gagal sampai Pages diaktifkan.
- Dua paket, Standard dan Advanced, semua modul `ready` termasuk di keduanya; yang membedakan hanya batas klub dan trial (`KAJIAN_PAKET.md`). Anggota dan lokasi tidak dibatasi. Modul `soon` (portal anggota, check-in) belum dibangun.

Sisa risiko keamanan
- Penguncian akun setelah 5 gagal login bisa dipicu orang lain yang tahu email (kunci 15 menit). Rate limit per IP (`hit_rate_limit`) membatasi skalanya.
- CSP baru membatasi framing/form/base-uri; belum membatasi script (butuh nonce).
- Belum ada FAQ, Kebijakan Privasi, dan Syarat & Ketentuan (wajib sebelum publik karena menyimpan data anak).
- Tidak ada payment gateway, invoice/kwitansi Swimma, proration, perpanjangan atau penangguhan otomatis saat periode berakhir (hanya ditandai lewat jatuh tempo di portal superadmin).

Terbuka
- Langganan `pending`, trial habis, `suspended` atau `cancelled` memblokir penambahan anggota, klub, dan pengguna internal (`SW003`); login dan halaman langganan tetap jalan. Hanya suspended/cancelled yang memutus akses semua klub.
- Angka di landing page ("1.240+", "27 klub", nama klub contoh) masih fiktif; ganti sebelum dipublikasikan.

Aturan teknis
- Semua waktu memakai WIB lewat helper di `lib/format.ts` (`formatJakarta*`, `parseJakartaLocalInput`); jangan pakai `toLocale*String` atau `new Date(datetimeLocal)` langsung.
- Hierarki: organisasi (akun pemilik) -> klub -> pelatih -> anggota. Anggota tidak punya login; tidak ada peran orang tua.
- Satu `/login` (email + kata sandi). Pemilik ada di `org_owners`; tiap klub punya satu profil `admin` pemilik (`profiles.owner_id`). Pindah klub memakai `switchTenant` (JWT dibuat ulang, tanpa kata sandi). Peran RLS: `admin`, `coach`, `receptionist`, `finance`. Kepala pelatih = `coach` dengan `profiles.is_head_coach` (bukan peran JWT terpisah). Akses halaman `/admin/*` per peran diatur di `canAccessPath` (`lib/auth/roles.ts`, dipakai proxy dan menu); RLS tetap penjaga utama.
- Email unik lintas pemilik dan pelatih (database); pelatih hanya di satu klub. Organisasi dan klub baru dibuat hanya lewat fungsi SQL `register_organization` / `create_tenant_for_owner` (service_role). Langganan ada di tingkat organisasi (`organization_subscriptions`); klub pertama organisasi tidak kena gate `SW003`.
- Harga dan batas hanya di tabel `subscription_plans` (jangan taruh angka harga di TypeScript). Harga = pengguna internal (pemilik aktif + admin/pelatih/resepsionis/keuangan aktif dengan `owner_id is null`, dihitung penuh, min 1) x harga/bulan x bulan (bulanan 1, tahunan 12 - `yearly_free_months`). Selalu hitung ulang di server lewat `platform_quote`; jangan percaya harga dari klien.
- Trigger database: `SW003` gate langganan, `SW004` batas klub (`coalesce(club_limit_override, club_limit)`, juga menolak turun paket yang melebihi batas). `SW001`/`SW002` sudah dihapus. `platform_plans`, `platform_subscriptions`, `organizations.max_tenants` tidak dipakai lagi (belum di-drop).
- Keuangan tidak boleh membaca tabel `members`; nama anggota untuk halaman keuangan diambil dari view `member_names`. Pelatih pengganti (`classes.substitute_id`) mengambil alih akses kelas itu dari pelatih asli; `coach_owns_class` memakai pelatih efektif `coalesce(substitute_id, instructor_id)`. Embed `profiles` dari `classes` wajib menyebut FK (`profiles!classes_instructor_id_fkey`).
- Suspended/cancelled mematikan akses lewat `tenants.is_active`; data tidak pernah dihapus.
- Ganti/atur ulang kata sandi mencabut semua sesi lama lewat `profiles.sessions_valid_after`.
- Aksi server yang dipakai sebagai form harus mengembalikan `ActionState` dan dibungkus `ActionForm`, supaya error tampil ke pengguna.
- Fungsi `security definer` baru wajib di-`revoke execute ... from public, anon, authenticated` kecuali memang untuk klien.
