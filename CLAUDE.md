@AGENTS.md

Always use the lean-dev skill.

## Catatan tim (per 2026-10-01)

Status
- Production Vercel: READY. Supabase project `swimma` masih kosong; migrasi 001-019 belum diterapkan dan env Supabase di Vercel belum mengarah ke project itu. `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_JWT_SECRET` harus diisi manual dari dashboard (project butuh legacy HS256 JWT secret).
- Setelah migrasi: `npm run seed:superadmin` untuk akun superadmin pertama. Jangan terapkan migrasi 012-019 sebelum kode versi ini dideploy (pemilik dipindah ke `org_owners`, parent dihapus, langganan pindah ke organisasi). Halaman harga di landing kosong sampai 014 diterapkan (harga hanya ada di tabel). Vercel Authentication masih aktif, situs belum publik. GitHub Pages (`mvp/`) gagal sampai Pages diaktifkan.
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
- Hierarki: organisasi (akun pemilik) -> klub -> pelatih -> anggota. Anggota bisa login (hanya baca, `/member`) setelah diaktifkan admin atau pelatihnya; tidak ada peran orang tua.
- Akun anggota: satu orang satu akun (`member_accounts`), tiap klub punya profil `member` (`profiles.member_account_id`, `members.profile_id`). Tabel akun hanya service role. Pindah klub memakai `switchClub`; sesi dengan banyak klub membawa `club_pending` sampai memilih (`requireMemberClub`). RLS peran `member` hanya select baris miliknya (`is_member()`, `current_member_id()`); tidak ada policy tulis. Portal digerbang `requireModule('member_portal')` (`lib/modules.ts`).
- Satu `/login` (email + kata sandi). Pemilik ada di `org_owners`; tiap klub punya satu profil `admin` pemilik (`profiles.owner_id`). Pindah klub memakai `switchTenant` (JWT dibuat ulang, tanpa kata sandi). Peran RLS: `admin`, `coach`, `receptionist`, `finance`, `member`. Kepala pelatih = `coach` dengan `profiles.is_head_coach` (bukan peran JWT terpisah). Akses halaman `/admin/*` per peran diatur di `canAccessPath` (`lib/auth/roles.ts`, dipakai proxy dan menu); RLS tetap penjaga utama.
- Email unik lintas pemilik, pelatih/staf, dan akun anggota (database): satu email satu jenis identitas, jadi pelatih tidak bisa sekaligus anggota. Pelatih hanya di satu klub. Satu akun anggota maksimal satu profil per klub. Organisasi dan klub baru dibuat hanya lewat fungsi SQL `register_organization` / `create_tenant_for_owner` (service_role). Langganan ada di tingkat organisasi (`organization_subscriptions`); klub pertama organisasi tidak kena gate `SW003`.
- Harga dan batas hanya di tabel `subscription_plans` (jangan taruh angka harga di TypeScript). Harga = pengguna internal (pemilik aktif + admin/pelatih/resepsionis/keuangan aktif dengan `owner_id is null`, dihitung penuh, min 1) x harga/bulan x bulan (bulanan 1, tahunan 12 - `yearly_free_months`). Selalu hitung ulang di server lewat `platform_quote`; jangan percaya harga dari klien.
- Trigger database: `SW003` gate langganan, `SW004` batas klub (`coalesce(club_limit_override, club_limit)`, juga menolak turun paket yang melebihi batas). `SW001`/`SW002` sudah dihapus. `platform_plans`, `platform_subscriptions`, `organizations.max_tenants` tidak dipakai lagi (belum di-drop).
- Keuangan tidak boleh membaca tabel `members`; nama anggota untuk halaman keuangan diambil dari view `member_names`. Pelatih pengganti (`classes.substitute_id`) mengambil alih akses kelas itu dari pelatih asli; `coach_owns_class` memakai pelatih efektif `coalesce(substitute_id, instructor_id)`. Embed `profiles` dari `classes` wajib menyebut FK (`profiles!classes_instructor_id_fkey`).
- Jenis klub (`tenants.club_type`: `swimming`, `gym`) dipilih saat klub dibuat dan tidak bisa diubah dari aplikasi. Modul klub = modul di `club_type_modules` untuk tipenya yang statusnya `ready` di `platform_modules` (`current_club_has_module`, `requireModule`/`isModuleReady` per klub). `terms` (`lib/club-type.ts`) baru dipakai di layar check-in.
- Check-in gym (modul `checkin`): QR berputar, token = 12 hex pertama HMAC-SHA256(rahasia titik, id titik + jendela 30 detik), berlaku jendela sekarang dan sebelumnya. `record_checkin` jalan dengan JWT anggota (kode `CK001` modul mati, `CK002` anggota nonaktif, `CK003` tanpa paket aktif, `CK004` sesi habis, `CK005` token/titik salah); scan ulang <120 menit mengembalikan baris lama. Klien tidak bisa insert ke `checkins` atau membaca `checkin_points.secret`. Klub dengan modul menghitung sesi paket dari check-in, bukan booking hadir. Simpan seminimal mungkin: tanpa IP atau data perangkat.
- Suspended/cancelled mematikan akses lewat `tenants.is_active`; data tidak pernah dihapus.
- Ganti/atur ulang kata sandi mencabut semua sesi lama lewat `profiles.sessions_valid_after`.
- Aksi server yang dipakai sebagai form harus mengembalikan `ActionState` dan dibungkus `ActionForm`, supaya error tampil ke pengguna.
- Fungsi `security definer` baru wajib di-`revoke execute ... from public, anon, authenticated` kecuali memang untuk klien.
