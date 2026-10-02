import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { getContact } from "@/lib/site";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Kebijakan Privasi (Draf)",
  description: `Draf kebijakan privasi ${APP_NAME}.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/privasi" },
};

export default function PrivacyPage() {
  const contact = getContact();
  return (
    <LegalPage title="Kebijakan Privasi" updated="Oktober 2026">
      <p>
        {APP_NAME} adalah aplikasi untuk mengelola klub olahraga. Klub (melalui pemilik dan stafnya) memasukkan dan
        mengelola data di dalam aplikasi. Halaman ini menjelaskan data apa yang disimpan aplikasi dan untuk apa.
      </p>

      <h2>Data yang disimpan</h2>
      <ul>
        <li>Pemilik organisasi: nama, email, kata sandi dalam bentuk hash bcrypt, waktu login terakhir, dan jumlah percobaan login gagal.</li>
        <li>Staf klub (admin, pelatih, resepsionis, keuangan): nama, email, nomor telepon bila diisi, peran, dan kata sandi dalam bentuk hash.</li>
        <li>
          Anggota: nama, tanggal lahir, alamat, catatan, lokasi pilihan, pelatih, serta nama dan nomor telepon kontak
          (misalnya orang tua) bila diisi oleh klub. Anggota dapat berupa anak.
        </li>
        <li>Akun anggota (bila diaktifkan klub): email dan kata sandi dalam bentuk hash.</li>
        <li>Kegiatan klub: jadwal kelas, booking kelas dan fasilitas, kehadiran beserta catatan pelatih, langganan, tagihan, pesanan kasir, pembayaran yang dicatat manual, buku kas, dan gaji pelatih.</li>
        <li>Check-in: anggota, titik check-in, waktu, paket, dan cara check-in. Alamat IP dan data perangkat tidak disimpan untuk check-in.</li>
        <li>Booking tamu: nama dan nomor telepon tamu bila diisi. Pesanan kasir tanpa anggota: nama pelanggan bila diisi.</li>
        <li>Gambar promo yang diunggah klub.</li>
        <li>Pembatasan percobaan login dan pendaftaran: alamat IP disimpan sementara sebagai kunci penghitung dan dibersihkan secara berkala.</li>
      </ul>

      <h2>Cookie dan penyimpanan di peramban</h2>
      <ul>
        <li>Cookie sesi <code>app_session</code> (httpOnly, berlaku hingga 7 hari) untuk menjaga Anda tetap masuk.</li>
        <li>Pilihan tema terang atau gelap disimpan di peramban Anda.</li>
        <li>Tidak ada skrip analitik, iklan, atau pelacakan pihak ketiga di aplikasi ini.</li>
      </ul>

      <h2>Layanan pihak ketiga</h2>
      <ul>
        <li>Supabase: basis data dan penyimpanan berkas.</li>
        <li>Vercel: hosting aplikasi.</li>
        <li>Tidak ada payment gateway; pembayaran dicatat manual oleh klub.</li>
      </ul>

      <h2>Pemisahan data antar klub</h2>
      <p>
        Data setiap klub dipisahkan di tingkat basis data dengan row level security, sehingga pengguna hanya dapat
        membaca data klub yang sedang aktif dalam sesinya, sesuai perannya.
      </p>

      <h2>Penyimpanan dan penghapusan</h2>
      <p>
        Saat langganan dihentikan, akses klub dimatikan tetapi data tidak dihapus otomatis. Permintaan akses, perbaikan,
        atau penghapusan data diajukan melalui klub Anda atau melalui kontak {APP_NAME}
        {contact.email ? ` di ${contact.email}` : ""}.
      </p>
    </LegalPage>
  );
}
