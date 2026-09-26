# Kajian Fitur per Paket Swimma

Status: **draf kajian, belum dibangun.** Keputusan final menunggu validasi ke klub (lihat bagian 8).

## 1. Tujuan

Menentukan fitur dan batas (cap) setiap paket supaya:

- tiap paket punya alasan jelas untuk dipilih atau di-upgrade,
- fitur yang dimasukkan benar-benar dipakai, bukan sekadar mengisi daftar,
- biaya variabel (WhatsApp, payment gateway) tidak menggerus margin.

## 2. Kondisi saat ini di kode

| Hal | Status |
|---|---|
| Batas anggota aktif per paket | Ditegakkan di database (trigger `children`, kode `SW001`) |
| Batas lokasi per paket | Ditegakkan di database (trigger `locations`, kode `SW002`) |
| Fitur per paket | Belum ada pembatasan; semua paket mendapat semua fitur |
| Anggota, jadwal, presensi, tagihan, buku kas, gaji, promo, laporan | Sudah ada |
| Pembayaran online, pengingat WA, ekspor data, rapor anak, presensi pelatih, pendaftaran online, laporan per lokasi | Belum ada |

## 3. Prinsip pembagian

1. **Uang dan kepercayaan tidak dibatasi.** Pembayaran online, keuangan dasar, dan ekspor data ada di semua paket. Membatasinya membuat klub tidak percaya dan mengurangi pendapatan fee transaksi.
2. **Pembeda utama adalah skala**: anggota, lokasi, kuota WA.
3. **Fitur pembeda hanya yang baru terasa perlu saat klub membesar**: banyak pelatih, banyak orang tua, banyak cabang.
4. **Trial menampilkan pengalaman Growth** dengan kuota kecil, supaya calon pelanggan merasakan fitur yang menjadi alasan upgrade.
5. **Sedikit tapi dipakai.** Fitur yang tidak jelas dipakai tidak dimasukkan ke paket mana pun.

## 4. Rancangan matriks

| | Trial | Starter | Growth | Pro |
|---|---|---|---|---|
| Harga/bulan | Gratis 14 hari | Rp300.000 | Rp750.000 | Rp1.500.000 |
| Anggota aktif | 20 | 75 | 250 | Tanpa batas |
| Lokasi kolam | 1 | 1 | 3 | Tanpa batas |
| Pengingat tagihan WA/bulan | 40 | 150 | 500 | 1.500 |
| Operasional inti (anggota, jadwal, presensi, promo) | ✓ | ✓ | ✓ | ✓ |
| Keuangan (tagihan, buku kas, gaji pelatih, laporan pendapatan & arus kas) | ✓ | ✓ | ✓ | ✓ |
| Pembayaran online (QRIS/VA/e-wallet) | ✓ | ✓ | ✓ | ✓ |
| Ekspor data | ✓ | ✓ | ✓ | ✓ |
| Rapor perkembangan anak | ✓ | — | ✓ | ✓ |
| Presensi pelatih → gaji otomatis | ✓ | — | ✓ | ✓ |
| Pendaftaran online halaman klub | ✓ | — | ✓ | ✓ |
| Laporan keuangan per lokasi/cabang | — | — | — | ✓ |
| Migrasi data & support prioritas | — | — | — | ✓ |

## 5. Alasan per fitur

| Fitur | Masalah yang diselesaikan | Siapa yang memakai | Paket | Catatan |
|---|---|---|---|---|
| Pembayaran online | Tunggakan, cek transfer manual | Orang tua, admin | Semua | Sumber fee transaksi; dana langsung ke rekening klub lewat split/sub-account |
| Pengingat WA | Orang tua lupa bayar | Orang tua | Semua (kuota) | Biaya per pesan, jadi dibatasi kuota |
| Keuangan | Pencatatan uang masuk/keluar | Admin, pemilik | Semua | Sudah ada; mencabutnya dari paket kecil akan terasa sebagai penurunan layanan |
| Ekspor data | Takut data terkunci | Pemilik | Semua | Membangun kepercayaan; biaya bangun kecil |
| Rapor perkembangan anak | Orang tua tidak tahu kemajuan anak | Pelatih, orang tua | Growth+ | Alasan orang tua membuka aplikasi; relevan saat pelatih lebih dari satu |
| Presensi pelatih → gaji | Hitung jam mengajar manual | Pelatih, admin | Growth+ | Bernilai saat pelatih banyak; klub kecil cukup input gaji manual |
| Pendaftaran online | Pendaftar lewat chat tercecer | Calon orang tua | Growth+ | Tetap lewat persetujuan admin agar cek duplikat anak berjalan |
| Laporan per lokasi | Tidak tahu cabang mana yang untung | Pemilik multi-cabang | Pro | Hanya bermakna jika lokasi > 3 |
| Migrasi & support prioritas | Takut repot pindah sistem | Klub besar | Pro | Biaya berupa waktu tim, bukan infrastruktur |

## 6. Unit ekonomi (asumsi, wajib diverifikasi)

| Komponen | Asumsi | Dampak |
|---|---|---|
| Infrastruktur tetap | Vercel Pro ~$24 + Supabase Pro ~$25 + buffer ~$20–30 ≈ Rp1,3 juta/bulan | Break-even ≈ 5 Starter / 2 Growth / 1 Pro |
| Biaya tenant tambahan | ≈ Rp0 sampai pemakaian naik tier | Margin paket berbayar tinggi |
| Pesan WA utility | ≈ Rp350/pesan (cek tarif Meta terkini) | Kuota Pro 1.500 ≈ Rp525 ribu, sepertiga harga paket; kuota tambahan dijual terpisah |
| Fee gateway | QRIS ~0,7%, VA ~Rp4.000/transaksi (cek tarif gateway) | Ditanggung klub; tidak boleh dibebankan ke orang tua untuk QRIS |
| Fee platform Swimma | Rp2.000–3.500 per tagihan lunas | Menutup margin tipis Starter |

## 7. Pertanyaan terbuka

1. Apakah keuangan tetap penuh di semua paket, atau gaji pelatih dan laporan lengkap mulai Growth?
2. Apakah Starter tanpa rapor anak dan presensi pelatih masih cukup menarik dibanding spreadsheet?
3. Apakah kuota WA memakai pesan WhatsApp resmi (berbayar), atau cukup tautan wa.me yang dikirim manual oleh admin?
4. Apakah perlu batas jumlah akun admin? Risikonya: akun dipakai bersama sehingga jejak audit rusak.
5. Berapa diskon paket tahunan (usulan awal: gratis 2 bulan)?
6. Apakah badge "Paling Populer" dipertahankan sebelum ada data pelanggan?

## 8. Rencana validasi sebelum dibangun

1. Wawancara 5–10 klub (kecil, menengah, multi-cabang): fitur apa yang dipakai setiap minggu, berapa lama admin mengurus tagihan, berapa tunggakan per bulan.
2. Uji harga: tunjukkan matriks ini, catat paket yang dipilih dan alasannya.
3. Setelah fitur dibangun, ukur pemakaian per fitur per klub selama 1–2 bulan; fitur yang jarang dipakai tidak dipakai sebagai pembeda paket.
4. Tetapkan matriks final, lalu bangun sesuai bagian 9.

## 9. Implikasi teknis saat dibangun

- `platform_plans`: kolom kuota (`wa_monthly_quota`) dan flag fitur (misalnya `features jsonb` atau kolom boolean per fitur).
- Penegakan di server/database, bukan hanya di UI, sama seperti batas anggota dan lokasi sekarang.
- Kartu harga di landing page dan banner dasbor membaca flag yang sama agar tidak berbeda dengan penegakan.
- Klub lama tanpa baris `platform_subscriptions` tetap tidak dibatasi (fail-open) sampai superadmin menetapkan paket.
