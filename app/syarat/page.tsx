import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan (Draf)",
  description: `Draf syarat dan ketentuan penggunaan ${APP_NAME}.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/syarat" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Syarat & Ketentuan" updated="Oktober 2026">
      <p>
        Syarat ini mengatur penggunaan {APP_NAME} oleh organisasi yang mendaftar (pemilik), staf yang ditambahkannya,
        dan anggota yang akunnya diaktifkan oleh klub.
      </p>

      <h2>Akun dan peran</h2>
      <ul>
        <li>Satu pendaftaran membuat satu organisasi, satu akun pemilik, dan klub pertama.</li>
        <li>Pemilik dan admin menambahkan staf dengan peran admin, pelatih, resepsionis, atau keuangan. Akses setiap peran dibatasi oleh aplikasi dan basis data.</li>
        <li>Satu email hanya dapat dipakai untuk satu jenis akun (pemilik, staf, atau anggota).</li>
        <li>Anggota hanya dapat membaca data miliknya sendiri.</li>
      </ul>

      <h2>Langganan dan pembayaran</h2>
      <ul>
        <li>Harga dihitung per pengguna internal (pemilik, admin, pelatih, resepsionis, dan keuangan yang aktif) sesuai paket dan periode yang dipilih, seperti tertera di halaman harga.</li>
        <li>Belum ada pembayaran online. Paket diaktifkan oleh tim {APP_NAME} setelah pembayaran diterima.</li>
        <li>Masa trial, batas klub, dan potongan tahunan mengikuti paket yang berlaku saat pendaftaran.</li>
        <li>Langganan yang belum aktif, trial yang habis, ditangguhkan, atau dibatalkan membatasi penambahan anggota, klub, dan pengguna internal. Penangguhan dan pembatalan menonaktifkan akses ke klub; data tidak dihapus.</li>
      </ul>

      <h2>Data klub</h2>
      <ul>
        <li>Klub bertanggung jawab atas data yang dimasukkannya, termasuk data anggota yang masih anak-anak dan persetujuan yang diperlukan.</li>
        <li>Pembayaran dari anggota ke klub dicatat manual oleh klub; {APP_NAME} tidak memproses uang.</li>
      </ul>

      <h2>Perubahan</h2>
      <p>Draf ini dapat berubah sebelum layanan dibuka untuk umum.</p>
    </LegalPage>
  );
}
