# Paket Langganan Swimma

Status: **dibangun** (migrasi `20250101000014_org_billing.sql`). Angka di bawah hanya bukti rancangan; nilai sebenarnya ada di tabel `subscription_plans` dan bisa diubah superadmin.

## 1. Model

- Langganan per **organisasi** (pemilik), bukan per klub. Satu organisasi punya satu paket, satu periode, dan satu status.
- Harga per **pengguna internal**: pemilik aktif ditambah admin dan pelatih aktif di semua klub organisasi. Akun admin pemilik di tiap klub dihitung satu kali. Anggota tidak dihitung dan tidak dibatasi. Minimal 1 pengguna.
- Komitmen bulanan atau tahunan. Tahunan = 12 dikurangi bulan gratis (awal: 0,5, jadi 11,5 bulan).

## 2. Dua paket

| | Standard | Advanced |
|---|---|---|
| Harga | Rp 150.000 / pengguna / bulan | Rp 250.000 / pengguna / bulan |
| Klub | maks 3 (bisa dinaikkan per organisasi oleh superadmin) | tak terbatas |
| Anggota dan lokasi | tak terbatas | tak terbatas |
| Modul | semua modul `ready` | semua modul `ready` |
| Trial | 30 hari | tidak ada; mulai `pending` sampai diaktifkan |
| Tahunan | 11,5 bulan | 11,5 bulan |

Contoh: Standard bulanan 4 pengguna = Rp 600.000; Standard tahunan 4 pengguna = 4 x 150.000 x 11,5 = Rp 6.900.000 (setara Rp 575.000/bulan); Advanced bulanan 2 pengguna = Rp 500.000.

## 3. Modul (`platform_modules`)

Registri tanpa harga. `ready`: anggota, paket keanggotaan, tagihan, buku kas, jadwal & presensi, gaji pelatih, promo. `soon`: portal anggota, check-in. Tipe klub nanti memakai registri ini untuk memilih modul.

## 4. Aturan akses

- `pending`, `trial` yang lewat tanggal akhir, `suspended`, dan `cancelled` menolak penambahan anggota, klub, dan pengguna internal (`SW003`). Login dan halaman langganan tetap jalan.
- Hanya `suspended` dan `cancelled` yang mematikan akses seluruh klub organisasi. Data tidak dihapus.
- Tidak ada penangguhan otomatis saat periode berakhir; portal superadmin hanya menandai lewat jatuh tempo.
- Tidak ada payment gateway: superadmin mengaktifkan setelah pembayaran di luar aplikasi dan mengisi tanggal periode.

## 5. Unit ekonomi (asumsi, wajib diverifikasi)

| Komponen | Asumsi | Dampak |
|---|---|---|
| Infrastruktur tetap | Vercel Pro ~$24 + Supabase Pro ~$25 + buffer ~$20-30 = Rp1,3 juta/bulan | Break-even ~9 pengguna Standard atau ~6 pengguna Advanced |
| Biaya organisasi tambahan | ~Rp0 sampai pemakaian naik tier | Margin tinggi |

## 6. Pertanyaan terbuka

1. Apakah Advanced perlu trial singkat? Sekarang Advanced hanya bisa dipakai setelah pembayaran.
2. Apakah diskon tahunan tetap 0,5 bulan, atau naik setelah ada data pelanggan?
3. Apakah batas klub Standard (3) perlu berbeda per organisasi lewat penjualan, atau cukup override superadmin?
4. Penagihan tingkat organisasi (invoice/kwitansi Swimma, perpanjangan otomatis, proration) belum dirancang.
